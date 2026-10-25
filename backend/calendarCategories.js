const {randomUUID}=require('node:crypto');
module.exports=function registerCategories(app,auth,{User,CalendarEntry,history}){
  app.get('/api/calendar/categories',auth,async(req,res)=>{
    try{const user=await User.findById(req.user.userId).select('calendarCategories').lean();if(!user)return res.status(404).json({message:'Account not found.'});res.set('Cache-Control','no-store').json(user.calendarCategories||[])}catch{res.status(503).json({message:'Could not load calendar categories.'})}
  });
  const change=mode=>async(req,res)=>{
    try{
      const name=typeof req.body?.name==='string'?req.body.name.trim():'',color=req.body?.color||'#728db3';
      if(mode!=='delete'&&(!name||name.length>60||/[\u0000-\u001f]/.test(name)))throw new Error('Enter a category name up to 60 characters.');
      if(mode!=='delete'&&(typeof color!=='string'||!/^#[a-f\d]{6}$/i.test(color)))throw new Error('Choose a valid category color.');
      const result=await history.mutate(req.user.userId,`${mode} calendar category`,async session=>{
        const user=await User.findById(req.user.userId).select('calendarCategories').session(session).lean();
        if(!user)throw new Error('Account not found.');
        const before=user.calendarCategories||[],id=mode==='create'?randomUUID():req.params.id;
        if(mode!=='create'&&!before.some(category=>category.id===id))throw new Error('Category not found.');
        if(mode==='create'&&before.length>=50)throw new Error('You can create up to 50 calendar categories.');
        if(mode!=='delete'&&before.some(category=>category.id!==id&&category.name.toLowerCase()===name.toLowerCase()))throw new Error('A category with that name already exists.');
        if(mode==='delete'&&await CalendarEntry.exists({user:req.user.userId,categoryId:id}).session(session))throw new Error('This category is in use. Move its events to another category or Uncategorized before deleting it.');
        const category={id,name,color:color.toLowerCase()};
        const after=mode==='create'?[...before,category]:mode==='delete'?before.filter(item=>item.id!==id):before.map(item=>item.id===id?category:item);
        await User.updateOne({_id:req.user.userId},{$set:{calendarCategories:after}},{session});
        return {value:{categories:after,category:mode==='delete'?null:category},kind:'categories',before,after};
      });
      res.status(mode==='create'?201:200).json(result);
    }catch(error){res.status(400).json({message:error.message||'Could not update calendar categories.'})}
  };
  app.post('/api/calendar/categories',auth,change('create'));
  app.put('/api/calendar/categories/:id',auth,change('rename'));
  app.delete('/api/calendar/categories/:id',auth,change('delete'));
};
