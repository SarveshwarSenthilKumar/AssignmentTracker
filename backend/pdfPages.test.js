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
const { insertPDFPages, parsePageRange } = require('./pdfPages');
test('merge selected pages in order and shift existing annotations', async () => {
  const result = await insertPDFPages(await fixture(), { position: 1, sources: [await fixture(), await fixture(2)], range: '2,1', annotations: [{id:'a'}, {id:'b',page:2}] });
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(),7);
  assert.deepEqual(pdf.getPages().map(page=>page.getWidth()),[600,601,600,601,600,601,602]);
  assert.deepEqual(result.annotations,[{id:'a',page:1},{id:'b',page:6}]);
  assert.equal(result.firstInsertedPage,2);
});
test('prepend and append retain rotation and annotation placement', async () => {
  for (const position of [0,3]) {
    const result = await insertPDFPages(await fixture(),{position,sources:[await fixture()],range:'3',annotations:[{page:1}]});
    const pdf = await PDFDocument.load(result.bytes);
    assert.equal(pdf.getPage(position).getRotation().angle,90);
    assert.equal(result.annotations[0].page,position===0?2:1);
  }
});
test('blank page matches rotated displayed size', async () => {
  const result = await insertPDFPages(await fixture(),{position:3,mode:'blank',currentPage:3});
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(),4);
  assert.deepEqual(pdf.getPage(3).getSize(),{width:800,height:602});
});
test('duplicate clones annotations with new ids even when inserted before source', async () => {
  const annotations=[{id:'text',page:2,text:'hello'},{id:'image',page:2,tool:'image',dataUrl:'png'}];
  const result = await insertPDFPages(await fixture(),{position:0,mode:'duplicate',currentPage:2,annotations});
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPage(0).getWidth(),601);
  assert.deepEqual(result.annotations.slice(0,2).map(item=>item.page),[3,3]);
  assert.deepEqual(result.annotations.slice(2).map(item=>item.page),[1,1]);
  assert.notEqual(result.annotations[2].id,'text');
  assert.equal(result.annotations[3].dataUrl,'png');
  assert.equal(annotations[0].page,2);
});
test('reject invalid ranges, positions, missing inputs, and damaged PDFs', async () => {
  assert.deepEqual(parsePageRange('1,3-4',4),[0,2,3]);
  for (const range of ['0','5','3-1','a','1,']) assert.throws(()=>parsePageRange(range,4));
  const bytes=await fixture();
  await assert.rejects(insertPDFPages(bytes,{position:5,sources:[bytes]}),/position/);
  await assert.rejects(insertPDFPages(bytes,{position:0}),/Choose between/);
  await assert.rejects(insertPDFPages(bytes,{position:0,sources:[Buffer.from('broken')]}));
});
