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
test('provider input is read-only, stateless, and includes supported files only when supplied',async()=>{
  const request=assistantRequest(base),context=workspaceContext({user:{}},request);
  const payload=await responsePayload(request,context,null,'test-model');
  assert.equal(payload.store,false);
  assert.equal(payload.tools,undefined);
  assert.match(payload.systemInstruction.parts[0].text,/read-only assistant/i);
  assert.equal(payload.contents[0].role,'user');
  assert.equal(payload.contents[0].parts.length,2);
  assert.equal(payload.contents[0].parts.at(-1).text,base.messages[0].content);
  const pdf={_id:documentId,name:'Notes',originalName:'notes.pdf',mimeType:'application/pdf',pdfData:Buffer.from('pdf')};
  assert.equal((await documentInput(pdf)).content.inlineData.mimeType,'application/pdf');
  assert.equal((await documentInput({...pdf,originalName:'image.png',mimeType:'image/png'})).content.inlineData.mimeType,'image/png');
  assert.equal((await documentInput({...pdf,originalName:'audio.mp3',mimeType:'audio/mpeg'})).content.inlineData.mimeType,'audio/mpeg');
  assert.equal((await documentInput({...pdf,originalName:'unsupported.zip',mimeType:'application/zip'})).content,undefined);
  assert.equal((await documentInput({...pdf,pdfData:Buffer.alloc(10*1024*1024+1)})).content,undefined);
  const attached=await responsePayload(request,context,pdf,'test-model');
  assert.equal(attached.contents[0].parts.length,4);
  assert.equal(context.openDocument.contentIncluded,true);
});
test('answers omit internal thoughts and link only supplied owner-scoped sources',()=>{
  const reply='Essay [[task:'+taskId+']] and [[document:'+documentId+']] and [[calendar:aaaaaaaaaaaaaaaaaaaaaaaa]]';
  const text=responseText({candidates:[{content:{parts:[{thought:true,text:'hidden'},{text:reply}]}}]});
  assert.equal(text,reply);
  const sources=responseSources(text,{tasks:[{id:taskId,title:'Essay'}],openDocument:{id:documentId,name:'Notes'}});
  assert.equal(sources.length,2);
  assert.equal(sources[1].type,'document');
  assert.throws(()=>responseText({candidates:[{finishReason:'SAFETY'}]}),/blocked/);
  assert.throws(()=>responseText({candidates:[]}),/no answer/);
});
