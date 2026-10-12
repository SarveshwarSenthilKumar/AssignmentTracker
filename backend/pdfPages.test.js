const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, degrees } = require('pdf-lib');
const { deletePDFPage } = require('./pdfPages');

async function fixture(count = 3) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([600 + i, 800]);
    if (i === 2) page.setRotation(degrees(90));
  }
  return pdf.save();
}

test('deleting a middle page preserves remaining pages and renumbers annotations', async () => {
  const annotations = [{ id: 'a', text: 'first' }, { id: 'b', page: 2 }, { id: 'c', page: 3, x: 25 }];
  const result = await deletePDFPage(await fixture(), 2, annotations);
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getPage(1).getWidth(), 602);
  assert.equal(pdf.getPage(1).getRotation().angle, 90);
  assert.deepEqual(result.annotations, [{ id: 'a', text: 'first', page: 1 }, { id: 'c', page: 2, x: 25 }]);
  assert.equal(annotations[2].page, 3);
});

test('deleting first and last pages removes only their annotations', async () => {
  for (const n of [1, 3]) {
    const result = await deletePDFPage(await fixture(), n, [1, 2, 3].map(page => ({ page })));
    assert.deepEqual(result.annotations, [{ page: 1 }, { page: 2 }]);
  }
});

test('last page and invalid inputs are rejected', async () => {
  await assert.rejects(deletePDFPage(await fixture(1), 1), /at least one/);
  for (const n of [0, -1, 1.5, 4, NaN]) await assert.rejects(deletePDFPage(await fixture(), n));
  await assert.rejects(deletePDFPage(await fixture(), 1, [null]), /Invalid annotations/);
});
