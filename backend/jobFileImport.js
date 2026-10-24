// Compatibility response for older clients: job files are now processed locally.
module.exports=function registerJobFileImport(app,auth){
  app.post('/api/jobs/extract-file',auth,(_req,res)=>res.status(410).json({message:'Job image/PDF imports now use local OCR without AI. Refresh the website, then import the file again.'}));
};
