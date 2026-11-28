const test = require('node:test');
const assert = require('node:assert/strict');
const { assignmentDetails, assignmentEstimate } = require('./canvasAssignmentEstimate');

test('Canvas instructions preserve visible text and omit embedded scripting', () => {
  assert.equal(assignmentDetails('<p>Read &amp; reflect.</p><script>discard()</script><p>Then answer 12 questions.</p>'), 'Read & reflect.' + String.fromCharCode(10) + 'Then answer 12 questions.');
});

test('time estimates prioritize explicit durations and decline sparse instructions', () => {
  assert.deepEqual(assignmentEstimate('Essay', 'Estimated time: 1 to 2 hours. Write 900 words.'), {
    low: 60, high: 120, reason: 'Time stated in the Canvas instructions.',
  });
  const questions = assignmentEstimate('Worksheet', 'Please complete all 12 questions before the class meeting.');
  assert.equal(questions.low, 29);
  assert.equal(questions.high, 82);
  assert.equal(assignmentEstimate('Final project', 'See link.'), null);
});
