const {brandPortrait}=require('../lib/portrait-branding');
const crypto=require('node:crypto');const sharp=require('sharp');
const {reply,sameOrigin,upload}=require('../lib/http');
const {ROLES,FORMATS,imageModel,formatOutput,checkSource,checkLikeness,editHeadshot}=require('../lib/headshot');
const {photoId,savePhotoRecord}=require('../lib/storage');
const {hashToken}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to create your image.'});
 let stage='upload';
 try{
  const {bytes,field}=await upload(req);const role=field('role'),type=field('format')||'headshot';
  if(!Object.hasOwn(FORMATS,type)||!Object.hasOwn(ROLES,role))return reply(res,400,{error:'Choose an image type and style.'});
  const source=await sharp(bytes).rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:96}).toBuffer();
  stage='source-check';const sourceCheck=await checkSource(source);
  if(!sourceCheck?.usable){console.info('source_retake',JSON.stringify({issue:sourceCheck.issue}));return reply(res,422,{error:sourceCheck.reason||'Retake with your face clearly visible.',code:'RETAKE'});}
  stage='generation';const edited=await editHeadshot(source,role,type);
  stage='format';const formatted=await formatOutput(edited,type);
  stage='review';const review=await checkLikeness(source,formatted,type);
  const passed=review.appearance==='consistent'&&review.composition==='pass';
  const path=passed?'ai-checked':'ai-review';
  const notice=passed?'AI image ready. Check your face before saving.':review.appearance==='consistent'?'AI image ready. Check the framing before saving.':'AI preview: check your face carefully. Try another version if it does not look like you.';
  // Review findings are advice, never a silent replacement with the camera photo.
  console.info('image_review',JSON.stringify({format:type,model:imageModel(),appearance:review.appearance,composition:review.composition,issues:review.issues}));
  stage='branding';const final=await brandPortrait(formatted,type);
  stage='storage';const id=photoId(),claim=crypto.randomBytes(32).toString('base64url');
  await savePhotoRecord({id,jpeg:final,phoneHash:'',look:type+':'+role,claimHash:hashToken(claim)});
  res.statusCode=200;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/jpeg');
  for(const [key,value]of Object.entries({'X-Photo-Id':id,'X-Claim-Token':claim,'X-RPB-Path':path,'X-Image-Format':type,'X-Image-Width':String(FORMATS[type].width),'X-Image-Height':String(FORMATS[type].height),'X-AI-Model':imageModel(),'X-AI-Edit':'success','X-AI-Check':passed?'passed':'review','X-AI-Appearance':review.appearance,'X-AI-Composition':review.composition,'X-Photo-Notice':encodeURIComponent(notice)}))res.setHeader(key,value);
  res.end(final);
 }catch(e){
  const code=typeof e.code==='string'&&/^(provider_\d+|insufficient_quota|billing_hard_limit_reached|model_not_found|invalid_api_key|content_policy_violation|rate_limit_exceeded|NO_KEY)$/.test(e.code)?e.code:'unavailable';
  console.warn('image_failure',JSON.stringify({stage,code}));
  return reply(res,503,{error:stage==='generation'?'The AI image could not be generated. Tap Retry; your photo and details are saved for this visit.':stage==='review'?'The image review could not finish. Tap Retry or retake.':'The image could not be completed. Tap Retry or retake.',code:'IMAGE_INCOMPLETE'});
 }
};
module.exports.config={api:{bodyParser:false}};
