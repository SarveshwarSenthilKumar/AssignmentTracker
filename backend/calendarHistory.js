function createCalendarHistory({ mongoose, User, CalendarEntry }) {
  const Change = mongoose.model('CalendarChange', new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    label: String,
    kind: String,
    entryId: mongoose.Schema.Types.ObjectId,
    seriesId: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  }, { timestamps: true }));
  const fields = value => {
    const { _id, user, createdAt, updatedAt, __v, ...data } = value || {};
    return data;
  };
  const same = (a,b) => JSON.stringify(Object.entries(fields(a)).sort()) === JSON.stringify(Object.entries(fields(b)).sort());
  const transaction = async (userId, operation) => {
    const session = await mongoose.startSession();
    let value;
    try {
      await session.withTransaction(async () => {
        const locked = await User.updateOne({_id:userId}, {$inc:{calendarHistoryRevision:1}}, {session});
        if (!locked.matchedCount) throw new Error('Account not found.');
        value = await operation(session);
      });
      return value;
    } finally { await session.endSession(); }
  };
  const mutate = (userId, label, operation) => transaction(userId, async session => {
    const {value,...change} = await operation(session);
    // Check category references under the same per-account transaction lock
    // used by category deletion, including series and season imports.
    const entries=['entry','series','calendar_import'].includes(change.kind)?(Array.isArray(change.after)?change.after:[change.after]).filter(Boolean):[];
    if(entries.some(entry=>entry.categoryId)){
      const user=await User.findById(userId).select('calendarCategories').session(session).lean();
      const known=new Set((user.calendarCategories||[]).map(category=>category.id));
      if(entries.some(entry=>entry.categoryId&&!known.has(entry.categoryId)))throw new Error('A selected calendar category was removed. Refresh and choose another category.');
    }
    await Change.create([{user:userId,label,...change}],{session});
    return value;
  });
  const register = (app, auth) => {
    app.get('/api/calendar/history', auth, async (req,res) => {
      res.set('Cache-Control','no-store');
      try {
        const latest=await Change.findOne({user:req.user.userId}).sort({_id:-1}).lean();
        res.json({canUndo:!!latest,label:latest?.label||''});
      } catch {res.status(500).json({message:'Could not load calendar undo history.'});}
    });
    app.post('/api/calendar/undo',auth,async(req,res)=>{
      try {
        const result=await transaction(req.user.userId,async session=>{
          const change=await Change.findOne({user:req.user.userId}).sort({_id:-1}).session(session).lean();
          if(!change)throw new Error('There are no calendar changes to undo.');
          if(change.kind==='categories'){
            const current=await User.findById(req.user.userId).select('calendarCategories').session(session).lean();
            if(JSON.stringify(current.calendarCategories||[])!==JSON.stringify(change.after))throw new Error('Categories changed elsewhere. Refresh before undoing.');
            const restored=new Set(change.before.map(category=>category.id));
            const removed=change.after.filter(category=>!restored.has(category.id)).map(category=>category.id);
            if(removed.length&&await CalendarEntry.exists({user:req.user.userId,categoryId:{$in:removed}}).session(session))throw new Error('This category is in use. Undo its event changes before undoing category creation.');
            await User.updateOne({_id:req.user.userId},{$set:{calendarCategories:change.before}},{session});
          }else if(change.kind==='visibility'){
            const current=await User.findById(req.user.userId).session(session).lean();
            const currentPrefs={hiddenCalendarIds:current.hiddenCalendarIds||[],hideTxstEvents:!!current.hideTxstEvents};
            if(JSON.stringify(currentPrefs)!==JSON.stringify(change.after))throw new Error('Calendar visibility changed elsewhere. Refresh before undoing.');
            await User.updateOne({_id:req.user.userId},{$set:change.before},{session});
          }else if(change.kind==='series'||change.kind==='calendar_import'){
            const filter=change.kind==='calendar_import'?{_id:{$in:change.after.map(entry=>entry._id)},user:req.user.userId}:{seriesId:change.seriesId,user:req.user.userId};
            const current=await CalendarEntry.find(filter).session(session).lean();
            const expected=new Map(change.after.map(entry=>[String(entry._id),entry]));
            if(current.length!==expected.size||current.some(entry=>!expected.has(String(entry._id))||!same(entry,expected.get(String(entry._id)))))throw new Error('This series changed elsewhere. Undo the newer changes first.');
            await CalendarEntry.deleteMany(filter,{session});
            if(change.before.length)await CalendarEntry.insertMany(change.before,{session,timestamps:false});
          }else if(change.kind==='color'){
            const current=await User.findById(req.user.userId).select('calendarColors').session(session).lean();
            const {id,color}=change.after;
            if((current.calendarColors?.[id]||null)!==color)throw new Error('This color changed elsewhere. Refresh before undoing.');
            const key=`calendarColors.${id}`;
            await User.updateOne({_id:req.user.userId},change.before.color?{$set:{[key]:change.before.color}}:{$unset:{[key]:1}},{session});
          }else{
            const current=await CalendarEntry.findOne({_id:change.entryId,user:req.user.userId}).session(session).lean();
            if(change.after ? !current||!same(current,change.after) : !!current)throw new Error('This event changed elsewhere and cannot safely be undone.');
            if(change.before)await CalendarEntry.replaceOne({_id:change.entryId,user:req.user.userId},change.before,{session,upsert:true,timestamps:false});
            else await CalendarEntry.deleteOne({_id:change.entryId,user:req.user.userId},{session});
          }
          await Change.deleteOne({_id:change._id},{session});
          return {message:`Undid ${change.label}.`};
        });
        res.json(result);
      }catch(error){res.status(409).json({message:error.message||'Could not undo this calendar change.'});}
    });
  };
  return {mutate,register,Change};
}
module.exports={createCalendarHistory};
