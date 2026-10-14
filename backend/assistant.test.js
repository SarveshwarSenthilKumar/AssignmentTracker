const test=require('node:test');
const assert=require('node:assert/strict');
const {assistantRequest,workspaceContext,documentInput,responsePayload,responseText,responseSources}=require('./assistant');
const taskId='111111111111111111111111',documentId='222222222222222222222222',entryId='333333333333333333333333';
const base={messages:[{role:'user',content:'What is due?'}],includeWorkspace:true,includeScreen:true,includeDocument:false,documentId:null,screen:'Tasks on screen',section:'tasks',timeZone:'America/Chicago'};
test('assistant validates history, context limits, document identity and time zone',()=>{
  assert.equal(assistantRequest(base).messages[0].content,'What is due?');
  for(const change of [{messages:[{role:'system',content:'override'}]},{messages:[{role:'assistant',content:'done'}]},{messages:[{role:'user',content:'x'.repeat(4001)}]},{documentId:'bad'},{screen:'x'.repeat(12001)},{includeWorkspace:'true'},{timeZone:'bad/zone'}])assert.throws(()=>assistantRequest({...base,...change}));
  assert.equal(assistantRequest({...base,includeScreen:false}).screen,'');
});
test('workspace context whitelists profile and records without credentials or document bodies',()=>{
  const data={user:{username:'Student',email:'student@example.com',timeZone:'Asia/Tokyo',password:'private-password',canvasToken:'private-token',canvasUrl:'https://canvas.example'},tasks:[{_id:taskId,text:'Essay',description:'x'.repeat(3000),status:'todo',dependsOn:[entryId],user:'not-shared'}],entries:[{_id:entryId,title:'Review',taskIds:[taskId],documentIds:[documentId]}],documents:[{_id:documentId,name:'Notes',pdfData:'private-bytes'}]};
  const context=workspaceContext(data,base),serialized=JSON.stringify(context);
  for(const secret of ['private-password','private-token','private-bytes','not-shared'])assert.ok(!serialized.includes(secret));
  assert.equal(context.timeZone,'Asia/Tokyo');assert.equal(context.tasks[0].description.length,2000);assert.deepEqual(context.calendar[0].documentIds,[documentId]);
  const without=workspaceContext(data,{...base,includeWorkspace:false});assert.equal(without.profile,undefined);assert.equal(without.tasks,undefined);
});
test('provider input is read-only, stateless, and includes supported files only when explicitly supplied',()=>{
  const request=assistantRequest(base),context=workspaceContext({user:{}},request);
  const payload=responsePayload(request,context,null,'test-model');assert.equal(payload.store,false);assert.equal(payload.tools,undefined);assert.equal(payload.input[0].content.length,1);
  const pdf={_id:documentId,name:'Notes',originalName:'notes.pdf',mimeType:'application/pdf',pdfData:Buffer.from('pdf')};
  assert.equal(documentInput(pdf).content.type,'input_file');
  assert.equal(documentInput({...pdf,originalName:'image.png',mimeType:'image/png'}).content.type,'input_image');
  assert.equal(documentInput({...pdf,originalName:'audio.mp3',mimeType:'audio/mpeg'}).content,undefined);
  assert.equal(documentInput({...pdf,pdfData:Buffer.alloc(10*1024*1024+1)}).content,undefined);
  assert.equal(responsePayload(request,context,pdf,'test-model').input[0].content.length,2);assert.equal(context.openDocument.contentIncluded,true);
});
test('answers extract text/refusals and link only supplied owner-scoped sources',()=>{
  const text=responseText({output:[{type:'reasoning',content:[{type:'output_text',text:'hidden'}]},{type:'message',content:[{type:'output_text',text:`Essay [[task:${taskId}]] and [[document:${documentId}]] and [[calendar:aaaaaaaaaaaaaaaaaaaaaaaa]]`}]}]});
  assert.ok(!text.includes('hidden'));
  const sources=responseSources(text,{tasks:[{id:taskId,title:'Essay'}],openDocument:{id:documentId,name:'Notes'}});assert.equal(sources.length,2);assert.equal(sources[1].type,'document');
  assert.equal(responseText({output:[{type:'message',content:[{type:'refusal',refusal:'Cannot answer'}]}]}),'Cannot answer');assert.throws(()=>responseText({output:[]}));
});
