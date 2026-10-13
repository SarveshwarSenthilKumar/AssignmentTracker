import test from 'node:test'
import assert from 'node:assert/strict'
import { fileKind, parseDelimited, serializeDelimited } from './documentFormats.js'
test('file routing supports legacy PDFs, images, Office, text, media and unknown attachments', () => {
  for (const [name,mime,kind] of [['a.pdf','','pdf'],['a.JPG','','image'],['a.docx','','word'],['a.xlsx','','workbook'],['a.csv','','table'],['a.tsv','','table'],['a.py','','text'],['a.html','','text'],['a.bin','text/plain','text'],['a.mp4','','video'],['a.mp3','','audio'],['a.pptx','','file'],['a.doc','','file']]) assert.equal(fileKind(name,mime),kind)
})
test('CSV round trips quoted delimiters, quotes, newlines, empty cells and Unicode', () => {
  const rows = [['name','description','empty'],['Zoë','a,b "quoted"\nnext',''],['日本語','value','']]
  assert.deepEqual(parseDelimited(serializeDelimited(rows)),rows)
  assert.deepEqual(parseDelimited('\uFEFFa,b\r\n1,2\r\n'),[['a','b'],['1','2']])
  assert.deepEqual(parseDelimited(''),[['']])
})
test('TSV preserves quoted tabs and multiline values', () => {
  const rows=[['a\tb','line\nnext'],['','x']]
  assert.deepEqual(parseDelimited(serializeDelimited(rows,'\t'),'\t'),rows)
  assert.throws(()=>parseDelimited('"unclosed'),/unclosed/)
})
