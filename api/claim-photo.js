const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {loadMeta,writeMeta,saveLead}=require('../lib/storage');
const {normalizeUsPhone,hashPhone,hashToken,sameHex}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to confirm.'});
 try{
  const b=await jsonBody(req);const phone=normalizeUsPhone(b.phone);
  if(!phone||b.confirmed!==true||b.likenessApproved!==true)return reply(res,400,{error:'Check your mobile number and approve the photo on screen.'});
  if(typeof b.claim!=='string'||b.claim.length>100)return reply(res,403,{error:'This visit has expired.'});
  const meta=await loadMeta(String(b.id||''));
  if(!meta?.claimHash||!sameHex(meta.claimHash,hashToken(b.claim)))return reply(res,403,{error:'This visit has expired. Please retake your photo.'});
  const phoneHash=hashPhone(phone);
  if(meta.phoneHash && !sameHex(meta.phoneHash,phoneHash))return reply(res,409,{error:'This photo already belongs to a confirmed number. Start a new visit to change it.'});
  // Deterministic ID deduplicates retries; no marketing enrollment or automatic emails.
  await saveLead({id:'headshot-'+meta.id,name:String(b.name||'').slice(0,120),company:String(b.company||'').slice(0,120),email:String(b.email||'').slice(0,254),phone,photoId:meta.id,look:meta.look,event:'LegacyCon 2026 · BPN Summit',source:'rpb-headshot',sms_consent:false,contactConfirmedAt:meta.contactConfirmedAt||new Date().toISOString()});
  if(!meta.phoneHash){meta.phoneHash=phoneHash;meta.contactConfirmedAt=new Date().toISOString();await writeMeta(meta.id,meta);}
  return reply(res,200,{ok:true,id:meta.id,path:'/p/'+meta.id});
 }catch{return reply(res,503,{error:'Your QR could not be prepared. Tap Confirm again; your photo and details are preserved.'});}
};
