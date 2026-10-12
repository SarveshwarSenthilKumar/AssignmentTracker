const { PDFDocument } = require('pdf-lib');

async function deletePDFPage(bytes, pageNumber, annotations = []) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error('Choose a valid page number.');
  }
  if (!Array.isArray(annotations) || annotations.some(item => !item || typeof item !== 'object' || !Number.isInteger(item.page ?? 1) || (item.page ?? 1) < 1)) {
    throw new Error('Invalid annotations.');
  }
  const document = await PDFDocument.load(bytes);
  const count = document.getPageCount();
  if (pageNumber > count) throw new Error('This page does not exist.');
  if (count <= 1) throw new Error('Keep at least one page in the PDF.');
  document.removePage(pageNumber - 1);
  const remaining = annotations
    .filter(item => (item.page ?? 1) !== pageNumber)
    .map(item => ({ ...item, page: (item.page ?? 1) > pageNumber ? item.page - 1 : (item.page ?? 1) }));
  return { bytes: Buffer.from(await document.save()), annotations: remaining, numPages: count - 1 };
}

module.exports = { deletePDFPage };
