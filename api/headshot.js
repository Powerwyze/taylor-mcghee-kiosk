const crypto=require('node:crypto');const sharp=require('sharp');
const {reply,sameOrigin,upload}=require('../lib/http');
const {ROLES,FORMATS,formatOutput,checkSource,checkLikeness,editHeadshot}=require('../lib/headshot');

const {photoId,savePhotoRecord}=require('../lib/storage');
const {hashToken}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to create your headshot.'});
 try{
  const {bytes,field}=await upload(req);const role=field('role');const type=field('format')||'headshot';
  if(!Object.hasOwn(FORMATS,type))return reply(res,400,{error:'Choose LinkedIn banner, profile picture or headshot.'});
  if(!ROLES[role])return reply(res,400,{error:'Choose a headshot category.'});
  const source=await sharp(bytes).rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:96}).toBuffer();
  let image=source,path='original',reason='The AI service could not complete the edit. Your original photo keeps your real features.';
  // Source and result checks are independent of generation and fail closed.
  let sourceCheck,editStatus='not-run',checkStatus='not-run';
  try{sourceCheck=await checkSource(source);}catch{}
  if(sourceCheck && !sourceCheck.usable)return reply(res,422,{error:'Please retake with only you in the frame, your whole face clearly visible and good light.',code:'RETAKE'});
  if(sourceCheck?.usable){
   try{
    const edited=await editHeadshot(source,role,type);editStatus='success';
    const formatted=await formatOutput(edited,type);
    if(await checkLikeness(source,formatted,type)){checkStatus='passed';image=formatted;path='ai-checked';reason='AI-assisted image. Please check that it still looks like you.';}
    else {checkStatus='rejected';reason='The AI edit changed your appearance, so we kept your original photo instead.';}
   }catch(e){if(editStatus==='success')checkStatus='unavailable';else editStatus=e.code||'unavailable';}
  }
  const final=path==='ai-checked'?image:await formatOutput(source,type,{original:true,role});const id=photoId(),claim=crypto.randomBytes(32).toString('base64url');
  await savePhotoRecord({id,jpeg:final,phoneHash:'',look:type+':'+role,claimHash:hashToken(claim)});
  res.statusCode=200;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/jpeg');
  res.setHeader('X-Photo-Id',id);res.setHeader('X-Claim-Token',claim);res.setHeader('X-RPB-Path',path);
  res.setHeader('X-Image-Format',type);res.setHeader('X-Image-Width',String(FORMATS[type].width));res.setHeader('X-Image-Height',String(FORMATS[type].height));
  res.setHeader('X-AI-Edit',editStatus);res.setHeader('X-AI-Check',checkStatus);
  res.setHeader('X-Photo-Notice',encodeURIComponent(reason));res.end(final);
 }catch{return reply(res,502,{error:'The headshot could not be saved. Your contact details are still here; tap Retry or retake your photo.'});}
};
module.exports.config={api:{bodyParser:false}};
