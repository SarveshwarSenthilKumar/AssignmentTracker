module.exports=function registerFolderHierarchy(app,auth,{mongoose,User,Folder,PDFFolder,Todo,PDF}){
  for(const [base,Model,Items,field]of [['/api/folders',Folder,Todo,'folder'],['/api/pdf-folders',PDFFolder,PDF,'pdfFolder']]){
    const write=mode=>async(req,res)=>{
      const session=await mongoose.startSession();
      try{
        let result;
        await session.withTransaction(async()=>{
          const owner=req.user.userId;
          const locked=await User.updateOne({_id:owner},{$inc:{folderHierarchyRevision:1}},{session});
          if(!locked.matchedCount)throw new Error('Account not found.');
          const folders=await Model.find({user:owner}).session(session).lean(),known=new Map(folders.map(folder=>[String(folder._id),folder]));
          const current=mode==='create'?null:known.get(req.params.id);
          if(mode!=='create'&&!current)throw new Error('Folder not found.');
          const data={};
          if(mode!=='delete'){
            if(mode==='create'||req.body.name!==undefined){if(typeof req.body.name!=='string'||!req.body.name.trim()||req.body.name.trim().length>120)throw new Error('Enter a folder name between 1 and 120 characters.');data.name=req.body.name.trim()}
            if(req.body.color!==undefined){if(typeof req.body.color!=='string'||!/^#[a-f\d]{6}$/i.test(req.body.color))throw new Error('Choose a valid folder color.');data.color=req.body.color}
            if(req.body.description!==undefined){if(typeof req.body.description!=='string'||req.body.description.length>2000)throw new Error('Folder description must be up to 2,000 characters.');data.description=req.body.description.trim()}
            const parent=req.body.parentId===undefined?(current?.parentId?String(current.parentId):null):req.body.parentId;
            if(parent!==null&&(typeof parent!=='string'||!known.has(parent)))throw new Error('Choose a parent folder from your account.');
            data.parentId=parent;
            const id=current?String(current._id):String(new mongoose.Types.ObjectId());
            known.set(id,{...current,...data,_id:id});
            for(const folder of known.values()){
              const seen=new Set();let next=String(folder._id),depth=0;
              while(next){if(seen.has(next))throw new Error('A folder cannot be inside itself or one of its subfolders.');seen.add(next);if(++depth>12)throw new Error('Folders can be nested up to 12 levels.');const entry=known.get(next);next=entry?.parentId?String(entry.parentId):null}
            }
            if(mode==='create'){const [folder]=await Model.create([{_id:id,...data,user:owner}],{session});result=folder}
            else result=await Model.findOneAndUpdate({_id:current._id,user:owner},{$set:data},{new:true,runValidators:true,session});
          }else{
            const parentId=current.parentId&&known.has(String(current.parentId))?String(current.parentId):null;
            await Model.updateMany({user:owner,parentId:current._id},{$set:{parentId}},{session});
            await Items.updateMany({user:owner,[field]:current._id},{$set:{[field]:parentId}},{session});
            await Model.deleteOne({_id:current._id,user:owner},{session});
            result={parentId,message:'Folder removed. Its contents and subfolders were kept and moved up one level.'};
          }
        });
        res.status(mode==='create'?201:200).json(result);
      }catch(error){res.status(400).json({message:error.message||'Could not update folder hierarchy.'})}finally{await session.endSession()}
    };
    app.post(base,auth,write('create'));app.put(`${base}/:id`,auth,write('update'));app.delete(`${base}/:id`,auth,write('delete'));
  }
};
