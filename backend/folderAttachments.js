module.exports=function(app,auth,{mongoose,User,Folder,PDFFolder,PDF,upload}){
  const valid=id=>typeof id==='string'&&/^[a-f\d]{24}$/i.test(id)
  for(const [base,Model] of [['/api/folders',Folder],['/api/pdf-folders',PDFFolder]]){
    const write=uploading=>async(req,res)=>{
      if(!valid(req.params.id))return res.status(400).json({message:'Invalid folder.'})
      if(uploading&&(!req.file||req.file.size>10*1024*1024))return res.status(400).json({message:'Choose a file up to 10 MB.'})
      if(!uploading&&(!valid(req.body.documentId)||typeof req.body.linked!=='boolean'))return res.status(400).json({message:'Choose a document and whether to attach it.'})
      const session=await mongoose.startSession()
      try{
        let result
        await session.withTransaction(async()=>{
          const user=req.user.userId
          const owner=await User.updateOne({_id:user},{$inc:{folderHierarchyRevision:1}},{session})
          if(!owner.matchedCount)throw new Error('Account no longer exists.')
          const folder=await Model.findOne({_id:req.params.id,user}).session(session)
          if(!folder)throw new Error('Folder no longer exists.')
          const ids=(folder.attachmentIds||[]).map(String),linked=uploading||req.body.linked
          let documentId=uploading?String(new mongoose.Types.ObjectId()):req.body.documentId,document
          if(linked&&!ids.includes(documentId)&&ids.length>=50)throw new Error('A folder description supports up to 50 attachments. Remove a link before adding more.')
          if(uploading){
            const name=String(req.file.originalname||'Attachment').slice(0,200)
            const [record]=await PDF.create([{_id:documentId,user,name,originalName:name,mimeType:req.file.mimetype||'application/octet-stream',pdfData:req.file.buffer,pdfFolder:Model===PDFFolder?folder._id:null}],{session})
            document=record.toObject();delete document.pdfData;delete document.originalBackup
          }else if(linked){
            document=await PDF.findOne({_id:documentId,user,deletedAt:null}).select('-pdfData -originalBackup').session(session).lean()
            if(!document)throw new Error('Choose an available document from your account.')
          }
          folder.attachmentIds=linked?[...new Set([...ids,documentId])]:ids.filter(id=>id!==documentId)
          await folder.save({session});result={folder:folder.toObject(),...(document?{document}:{})}
        })
        res.status(uploading?201:200).json(result)
      }catch(error){res.status(400).json({message:error.message||'Could not update folder attachments.'})}finally{await session.endSession()}
    }
    app.put(`${base}/:id/attachments`,auth,write(false))
    app.post(`${base}/:id/attachments`,auth,(req,res,next)=>upload.single('pdfFile')(req,res,error=>error?res.status(400).json({message:error.code==='LIMIT_FILE_SIZE'?'Choose a file up to 10 MB.':'Could not read the attachment upload.'}):next()),write(true))
  }
}
