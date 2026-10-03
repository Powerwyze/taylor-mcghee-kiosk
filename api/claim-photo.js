const crypto=require('node:crypto');
const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {loadMeta,writeMeta}=require('../lib/storage');
const {hashToken,sameHex}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to approve your photo.'});
 try{
  const b=await jsonBody(req);
  if(b.likenessApproved!==true)return reply(res,400,{error:'Please approve the photo on screen first.'});
  if(typeof b.claim!=='string'||b.claim.length<20||b.claim.length>100)return reply(res,403,{error:'This visit has expired.'});
  const meta=await loadMeta(String(b.id||''));
  if(!meta?.claimHash||!sameHex(meta.claimHash,hashToken(b.claim)))return reply(res,403,{error:'This visit has expired. Please retake your photo.'});
  const viewToken=crypto.randomBytes(32).toString('base64url');
  meta.viewHash=hashToken(viewToken);meta.approvedAt=new Date().toISOString();
  await writeMeta(meta.id,meta);
  return reply(res,200,{ok:true,id:meta.id,path:'/p/'+meta.id+'?token='+encodeURIComponent(viewToken),viewToken});
 }catch{return reply(res,503,{error:'Your QR could not be prepared. Tap again to retry.'});}
};
