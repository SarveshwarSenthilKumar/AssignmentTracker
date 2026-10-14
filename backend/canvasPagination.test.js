const test=require('node:test'),assert=require('node:assert/strict');
const {collectCanvasPages,nextCanvasPage}=require('./canvasPagination');
test('Canvas list fetching follows opaque next links and retains every page',async()=>{
 const requests=[];
 const rows=await collectCanvasPages('https://school.example','token','/api/v1/courses?per_page=100',async(base,token,url)=>{requests.push(url);return requests.length===1?{items:[{id:1}],link:'<https://school.example/api/v1/courses?page=opaque-value>; rel="next", <https://school.example/api/v1/courses?page=1>; rel="first"'}:{items:[{id:2}],link:''}});
 assert.deepEqual(rows,[{id:1},{id:2}]);assert.match(requests[1],/page=opaque-value/);
 assert.equal(nextCanvasPage('',requests[0],'https://school.example'),null);
});
test('pagination refuses foreign origins, loops and non-list responses',async()=>{
 assert.throws(()=>nextCanvasPage('<https://other.example/data>; rel="next"','https://school.example/data','https://school.example'));
 await assert.rejects(collectCanvasPages('https://school.example','token','/data',async()=>({items:[],link:'<https://school.example/data>; rel="next"'})));
 await assert.rejects(collectCanvasPages('https://school.example','token','/data',async()=>({items:{error:'unexpected'},link:''})));
});
