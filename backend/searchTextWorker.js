const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
  const {name,data,annotations=[]}=workerData,bytes=Buffer.from(data),parts=[];
  let size=0;
  const add=value=>{size+=value.length;if(size>2000000)throw new Error('File text exceeds the two-million-character indexing limit.');parts.push(value)};
  if(/\.pdf$/i.test(name)){
    const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
    const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,verbosity:0});
    try{
      const pdf=await task.promise;
      for(let number=1;number<=pdf.numPages;number++){
        const content=await(await pdf.getPage(number)).getTextContent();
        const hidden=new Set(annotations.filter(item=>(item.page||1)===number&&item.sourceText).map(item=>item.sourceText.key));
        let text='',previous;
        content.items.forEach((item,index)=>{
          if(hidden.has(`${number}:${index}`)||typeof item.str!=='string')return;
          if(previous&&previous.transform&&item.transform){
            const size=Math.max(1,Math.hypot(item.transform[2],item.transform[3]));
            const sameLine=Math.abs(previous.transform[5]-item.transform[5])<size*.5;
            const gap=item.transform[4]-(previous.transform[4]+previous.width);
            if(!/\s$/.test(text)&&!/^\s/.test(item.str)&&(!sameLine||gap>size*.12))text+=' ';
          }
          text+=item.str;previous=item;
        });
        add(text);
        const embeddedAnnotations=await(await pdf.getPage(number)).getAnnotations({intent:'display'}).catch(()=>[]);
        for(const annotation of embeddedAnnotations)for(const value of [annotation.fieldName,annotation.fieldValue,annotation.contentsObj?.str])if(typeof value==='string')add(value);
      }
    }finally{await task.destroy()}
  }else if(/\.docx$/i.test(name)){
    add((await require('mammoth').extractRawText({buffer:bytes})).value);
  }else if(/\.xlsx$/i.test(name)){
    const book=new (require('exceljs').Workbook)();await book.xlsx.load(bytes);
    book.eachSheet(sheet=>{add(sheet.name);sheet.eachRow(row=>add(row.values.slice(1).map(value=>typeof value==='object'?value?.text??value?.result??JSON.stringify(value):String(value??'')).join(' '))) });
  }else if(/\.(txt|md|markdown|csv|tsv|json|html?|xml|svg|log|ya?ml|tex|js|jsx|ts|tsx|py|cpp|c|h|css)$/i.test(name))add(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  else {parentPort.postMessage({status:'unsupported',text:''});return}
  for(const item of annotations)if(item.tool==='text'&&typeof item.text==='string')add(item.text);
  const text=parts.join('\n');parentPort.postMessage({status:text.trim()?'ready':'empty',text});
})().catch(error=>parentPort.postMessage({status:'failed',text:'',error:error.message.slice(0,200)}));
