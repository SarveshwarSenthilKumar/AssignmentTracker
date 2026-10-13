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

function parsePageRange(range, count) {
  if (!range || !range.trim()) return Array.from({ length: count }, (_, index) => index);
  const indices = [];
  for (const part of range.split(',')) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);
    if (!match) throw new Error('Use page numbers or ranges, such as 1, 3-5.');
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (start < 1 || end > count || end < start) throw new Error(`Choose pages between 1 and ${count}, with ascending ranges.`);
    for (let page = start; page <= end; page++) indices.push(page - 1);
    if (indices.length > 500) throw new Error('Insert up to 500 pages at a time.');
  }
  return indices;
}

async function insertPDFPages(bytes, { position, sources = [], range = '', mode = 'files', currentPage = 1, annotations = [] }) {
  if (!Array.isArray(annotations) || annotations.some(item => !item || typeof item !== 'object' || !Number.isInteger(item.page ?? 1) || (item.page ?? 1) < 1)) throw new Error('Invalid annotations.');
  const document = await PDFDocument.load(bytes);
  const count = document.getPageCount();
  if (!Number.isInteger(position) || position < 0 || position > count) throw new Error('Choose a valid insertion position.');
  const added = [];
  if (mode === 'blank' || mode === 'duplicate') {
    if (!Number.isInteger(currentPage) || currentPage < 1 || currentPage > count) throw new Error('Choose a valid current page.');
    const original = document.getPage(currentPage - 1);
    if (mode === 'duplicate') added.push(...await document.copyPages(document, [currentPage - 1]));
    else {
      const box = original.getCropBox();
      const angle = ((original.getRotation().angle % 360) + 360) % 360;
      added.push(document.addPage(angle % 180 ? [box.height, box.width] : [box.width, box.height]));
      document.removePage(document.getPageCount() - 1);
    }
  } else if (mode === 'files') {
    if (!Array.isArray(sources) || !sources.length || sources.length > 10) throw new Error('Choose between 1 and 10 PDF files.');
    for (const source of sources) {
      const incoming = await PDFDocument.load(source);
      const indices = parsePageRange(range, incoming.getPageCount());
      if (added.length + indices.length > 500) throw new Error('Insert up to 500 pages at a time.');
      added.push(...await document.copyPages(incoming, indices));
    }
  } else throw new Error('Choose a supported page operation.');
  added.forEach((page, index) => document.insertPage(position + index, page));
  const remaining = annotations.map(item => ({ ...item, page: (item.page ?? 1) > position ? (item.page ?? 1) + added.length : (item.page ?? 1) }));
  if (mode === 'duplicate') {
    annotations.filter(item => (item.page ?? 1) === currentPage).forEach(item => remaining.push({ ...item, id: `copy_${require('crypto').randomUUID()}`, page: position + 1 }));
  }
  return { bytes: Buffer.from(await document.save()), annotations: remaining, numPages: count + added.length, insertedPages: added.length, firstInsertedPage: position + 1 };
}

module.exports = { deletePDFPage, insertPDFPages, parsePageRange };
