const access=require('./adminAccess');
module.exports=(app,auth,mongoose)=>{
  const summary=async(name,kind)=>{
    const Model=mongoose.models[name];
    if(!Model)throw new Error('Missing model');
    const [data]=await Model.aggregate([{$facet:{
      statuses:[{$group:{_id:'$status',count:{$sum:1}}}],
      recent:[{$match:{createdAt:{$gte:new Date(Date.now()-7*86400000)}}},{$count:'count'}],
      urgent:kind==='bugs'?[{$match:{status:{$in:['open','in-review']},severity:{$in:['major','blocking']}}},{$count:'count'}]:[{$match:{status:{$in:['submitted','reviewing']},priority:{$in:['important','essential']}}},{$count:'count'}]
    }}]).option({maxTimeMS:10000});
    return {statuses:data.statuses,total:data.statuses.reduce((sum,item)=>sum+item.count,0),recent:data.recent[0]?.count||0,urgent:data.urgent[0]?.count||0};
  };
  app.get('/api/admin/overview',auth,async(req,res)=>{
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
    try{
      const capabilities=await access(mongoose,req.user.userId);
      if(!capabilities.bugs&&!capabilities.features)return res.status(403).json({message:'This account does not have bug-report or feature-suggestion review access.'});
      const [bugs,features]=await Promise.all([capabilities.bugs?summary('BugReport','bugs'):null,capabilities.features?summary('FeatureSuggestion','features'):null]);
      res.json({capabilities,bugs,features,generatedAt:new Date().toISOString()});
    }catch{res.status(503).json({message:'Could not load the admin overview. Please retry.'})}
  });
};
