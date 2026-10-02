const crypto=require('node:crypto');const sharp=require('sharp');
const {reply,sameOrigin,upload}=require('../lib/http');
const {ROLES,checkSource,checkLikeness,editHeadshot}=require('../lib/headshot');
const {compositeLogoBand}=require('../lib/logo-band');
const {photoId,savePhotoRecord}=require('../lib/storage');
const {hashToken}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to create your headshot.'});
 try{
  const {bytes,field}=await upload(req);const role=field('role');
  if(!ROLES[role])return reply(res,400,{error:'Choose a headshot category.'});
  const source=await sharp(bytes).rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:96}).toBuffer();
  let image=source,path='original',reason='The AI service could not complete the edit. Your original photo keeps your real features.';
  // Source and result checks are independent of generation and fail closed.
  let sourceCheck;
  try{sourceCheck=await checkSource(source);}catch{}
  if(sourceCheck && !sourceCheck.usable)return reply(res,422,{error:'Please retake with only you in the frame, your whole face clearly visible and good light.',code:'RETAKE'});
  if(sourceCheck?.usable){
   try{
    const edited=await editHeadshot(source,role);
    if(await checkLikeness(source,edited)){image=edited;path='ai-checked';reason='AI-assisted headshot. Please check that it still looks like you.';}
    else reason='The AI edit changed your appearance, so we kept your original photo instead.';
   }catch{}
  }
  const final=await compositeLogoBand(image);const id=photoId(),claim=crypto.randomBytes(32).toString('base64url');
  await savePhotoRecord({id,jpeg:final,phoneHash:'',look:role,claimHash:hashToken(claim)});
  res.statusCode=200;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/jpeg');
  res.setHeader('X-Photo-Id',id);res.setHeader('X-Claim-Token',claim);res.setHeader('X-RPB-Path',path);
  res.setHeader('X-Photo-Notice',encodeURIComponent(reason));res.end(final);
 }catch{return reply(res,502,{error:'The headshot could not be saved. Your contact details are still here; tap Retry or retake your photo.'});}
};
module.exports.config={api:{bodyParser:false}};
