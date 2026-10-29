const configured=(name,email)=>String(process.env[name]||'').split(',').some(value=>value.trim().toLowerCase()===email);

module.exports=async(mongoose,userId)=>{
  const user=await mongoose.models.User.findById(userId).select('username email').lean();
  if(!user)return {bugs:false,features:false,roadmap:false};
  const email=user.email.toLowerCase(),admin=configured('ADMIN_PORTAL_EDITOR_EMAILS',email);
  const roadmap=admin||configured('SITE_ROADMAP_EDITOR_EMAILS',email);
  // Keep the existing reviewer-list fallback behavior while adding one optional
  // full-administrator list. These capabilities are checked on every request.
  const bugList=process.env.BUG_REPORT_EDITOR_EMAILS?'BUG_REPORT_EDITOR_EMAILS':'SITE_ROADMAP_EDITOR_EMAILS';
  const featureList=process.env.FEATURE_SUGGESTION_EDITOR_EMAILS?'FEATURE_SUGGESTION_EDITOR_EMAILS':process.env.BUG_REPORT_EDITOR_EMAILS?'BUG_REPORT_EDITOR_EMAILS':'SITE_ROADMAP_EDITOR_EMAILS';
  return {bugs:admin||configured(bugList,email),features:admin||configured(featureList,email),roadmap};
};
