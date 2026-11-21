const unexpired=()=>({$and:[{$or:[{shareLinkExpiresAt:null},{shareLinkExpiresAt:{$gt:new Date()}}]}]});
const expired=file=>!!file.shareLinkExpiresAt&&new Date(file.shareLinkExpiresAt).getTime()<=Date.now();
module.exports={unexpired,expired};
