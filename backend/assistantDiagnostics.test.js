const test = require('node:test');
const assert = require('node:assert/strict');
const { providerDiagnostic, callAssistantAPI, AssistantAPIError, safeMessage, retrySeconds, durationSeconds } = require('./assistantDiagnostics');

const headers = values => ({ get: key => values[key] ?? null });
const response = (status, data, values = {}) => ({ ok: status < 400, status, headers: headers(values), json: async () => data });
const limit = details => ({ error: { status: 'RESOURCE_EXHAUSTED', details } });
const retry = retryDelay => ({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay });

test('daily and zero Gemini quotas take priority over retry advice', () => {
  for (const violation of [{ quotaMetric: 'requests_per_day', quotaValue: '100' }, { quotaMetric: 'input_tokens', quotaValue: '0' }]) {
    const report = providerDiagnostic(429, limit([
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [violation] }, retry('60s'),
    ]), headers({ 'x-goog-request-id': 'request-id' }));
    assert.equal(report.category, 'quota');
    assert.equal(report.retryable, false);
    assert.equal(report.retryAfterSeconds, null);
    assert.equal(report.providerRequestId, 'request-id');
    assert.equal(report.quotaDetails.length, 1);
  }
});

test('temporary throttling honors retry headers and Gemini RetryInfo', () => {
  const data = limit([retry('1.5s')]);
  assert.equal(retrySeconds(headers({}), Date.now(), data), 2);
  const report = providerDiagnostic(429, data, headers({ 'retry-after': '45' }));
  assert.equal(report.category, 'rate_limit');
  assert.equal(report.retryAfterSeconds, 45);
  assert.equal(durationSeconds('1m500ms'), 61);
  assert.equal(durationSeconds('bad'), null);
  const now = Date.parse('2026-10-14T12:00:00Z');
  assert.equal(retrySeconds(headers({ 'retry-after': 'Wed, 14 Oct 2026 12:00:30 GMT' }), now), 30);
  assert.equal(providerDiagnostic(503, {}, headers({ 'retry-after': '10' })).retryAfterSeconds, 10);
});

test('Gemini context size, authentication, permissions and model access have separate diagnostics', () => {
  const inputs = [
    [400, { message: 'Request too large' }, 'context_too_large'],
    [400, { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }] }, 'authentication'],
    [403, { status: 'PERMISSION_DENIED' }, 'permission'],
    [404, { status: 'NOT_FOUND' }, 'model_access'],
    [400, { status: 'INVALID_ARGUMENT' }, 'invalid_request'],
  ];
  for (const [status, error, category] of inputs) {
    assert.equal(providerDiagnostic(status, { error }, headers({})).category, category);
  }
});

test('provider messages redact credentials and private identifiers', () => {
  const key = 'AIzaPrivateKey';
  const text = JSON.stringify(providerDiagnostic(401, { error: { message: 'Incorrect key: ' + key + ' Bearer private-token org-private-id' } }, headers({}), {}, [key]));
  for (const secret of [key, 'private-token', 'org-private-id']) assert.ok(!text.includes(secret));
  assert.ok(!safeMessage('sk-proj-abcd***wxyz').includes('abcd'));
});

test('Gemini transport preserves feature instructions and always adds the safety policy', async () => {
  const key = 'AIzaFakeTestKey';
  const featureInstruction = { text: 'Return JSON for the selected feature.' };
  const payload = { model: 'models/gemini-test', systemInstruction: { parts: [featureInstruction] }, store: false };
  let transport;
  const result = await callAssistantAPI(payload, {
    apiKey: key,
    traceId: 'trace-test',
    fetcher: async (url, options) => {
      transport = { url, options };
      return response(200, { usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 1 } }, { 'x-goog-request-id': 'request-id' });
    },
  });
  assert.equal(transport.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
  assert.equal(transport.options.headers['x-goog-api-key'], key);
  const body = JSON.parse(transport.options.body);
  assert.equal(body.store, false);
  assert.match(body.systemInstruction.parts[0].text, /self-harm/i);
  assert.deepEqual(body.systemInstruction.parts[1], featureInstruction);
  assert.deepEqual(payload.systemInstruction.parts, [featureInstruction]);
  assert.equal(result.diagnostics.inputTokens, 8);
  assert.equal(result.diagnostics.traceId, 'trace-test');
  assert.equal(result.diagnostics.providerRequestId, 'request-id');
  assert.ok(!JSON.stringify(result.diagnostics).includes(key));
});

test('network, timeout, malformed JSON and provider safety blocks remain distinct', async () => {
  const apiKey = 'unused-test-key';
  const payload = { model: 'test' };
  const check = (category, fetcher, signal) => assert.rejects(callAssistantAPI(payload, { apiKey, fetcher, signal }),
    error => error instanceof AssistantAPIError && error.diagnostics.category === category);
  const network = async () => { throw Object.assign(new Error('Connection failed'), { code: 'ENOTFOUND' }); };
  await check('network', network);
  await check('timeout', network, AbortSignal.abort());
  await check('invalid_response', async () => ({ ...response(200), json: async () => { throw new Error('invalid JSON'); } }));
  await check('blocked', async () => response(200, { candidates: [{ finishReason: 'SAFETY' }] }));
  await check('quota', async () => response(429, limit([])));
});
