const test = require('node:test');
const assert = require('node:assert/strict');
const { documentAction } = require('./documentActions');
const a='a'.repeat(24), b='b'.repeat(24), folder='c'.repeat(24);
test('bulk moves retain unique ids and use a validated destination',()=>{
 const action=documentAction({action:'move',ids:[a,b,a],folderId:folder});
 assert.deepEqual(action.ids,[a,b]);assert.equal(action.update.pdfFolder,folder);assert.ok(action.update.updatedAt instanceof Date);
 assert.equal(documentAction({action:'move',ids:[a],folderId:null}).update.pdfFolder,null);
});
test('trash is reversible and preserves folder membership',()=>{
 const trash=documentAction({action:'trash',ids:[a]});assert.ok(trash.update.deletedAt instanceof Date);assert.equal(trash.update.pdfFolder,undefined);
 const restore=documentAction({action:'restore',ids:[a]});assert.equal(restore.update.deletedAt,null);assert.equal(restore.update.pdfFolder,undefined);
});
test('reject malformed ids, oversized selections and invalid actions or destinations',()=>{
 for(const body of [{action:'delete',ids:[a]},{action:'move',ids:[],folderId:null},{action:'trash',ids:['bad']},{action:'restore',ids:Array(501).fill(a)},{action:'move',ids:[a],folderId:{$ne:null}},{action:'move',ids:[a]}]) assert.throws(()=>documentAction(body));
});
