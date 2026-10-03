const {brandPortrait}=require('../lib/portrait-branding');
const crypto=require('node:crypto'),sharp=require('sharp');
const {reply,sameOrigin,upload}=require('../lib/http');
const {FORMAT,imageModel,checkSource,prepareOutpaint,editBackground,mergeOriginal,reviewExpansion}=require('../lib/expanded-photo');
const {photoId,savePhotoRecord}=require('../lib/storage');
const {hashToken}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to create your image.'});
 let stage='upload';const started=Date.now(),timings={};let tick=started;const mark=name=>{const now=Date.now();timings[name]=now-tick;tick=now;};
 try{
  const {bytes,field}=await upload(req);if(field('format')&&field('format')!==FORMAT.id)return reply(res,400,{error:'Choose the expanded photo.'});
  const source=await sharp(bytes).rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).jpeg({quality:96}).toBuffer();
  mark('prepare');stage='source-check';const sourceCheck=await checkSource(source);
  if(!sourceCheck.usable)return reply(res,422,{error:sourceCheck.reason||'Retake with guests clearly visible.',code:'RETAKE'});
  mark('sourceCheck');stage='expansion';const prepared=await prepareOutpaint(source),generated=await editBackground(prepared);
  mark('expansion');stage='preservation';const merged=await mergeOriginal(generated,prepared);
  mark('preservation');stage='review';const review=await reviewExpansion(source,merged);
  mark('review');const passed=review.appearance==='consistent'&&review.composition==='pass'&&!review.issues.includes('extra_person')&&!review.issues.includes('duplicate_person');
  const path=passed?'ai-checked':'ai-review';const notice=passed?'Your wider photo is ready. Check it before saving.':'Check the backdrop and guests carefully. Try another version if anything looks wrong.';
  console.info('image_review',JSON.stringify({format:FORMAT.id,model:imageModel(),appearance:review.appearance,composition:review.composition,issues:review.issues}));
  stage='branding';const final=await brandPortrait(merged,FORMAT.id);
  mark('branding');stage='storage';const id=photoId(),claim=crypto.randomBytes(32).toString('base64url');
  await savePhotoRecord({id,jpeg:final,phoneHash:'',look:'expanded-backdrop',claimHash:hashToken(claim)});
  mark('storage');console.info('image_timing',JSON.stringify({format:FORMAT.id,quality:'medium',...timings,total:Date.now()-started}));res.setHeader('Server-Timing',Object.entries(timings).map(([k,v])=>k+';dur='+v).join(', '));
  res.statusCode=200;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/jpeg');
  for(const [key,value]of Object.entries({'X-Photo-Id':id,'X-Claim-Token':claim,'X-RPB-Path':path,'X-Image-Format':FORMAT.id,'X-Image-Width':String(FORMAT.width),'X-Image-Height':String(FORMAT.height),'X-AI-Model':imageModel(),'X-AI-Edit':'success','X-AI-Check':passed?'passed':'review','X-AI-Appearance':review.appearance,'X-AI-Composition':review.composition,'X-Photo-Notice':encodeURIComponent(notice)}))res.setHeader(key,value);
  res.end(final);
 }catch(e){
  const code=typeof e.code==='string'&&/^(provider_\d+|insufficient_quota|billing_hard_limit_reached|model_not_found|invalid_api_key|content_policy_violation|rate_limit_exceeded|NO_KEY)$/.test(e.code)?e.code:'unavailable';
  console.warn('image_failure',JSON.stringify({stage,code}));
  return reply(res,503,{error:stage==='expansion'?'The backdrop could not be expanded. Tap Retry; your photo and details are saved for this visit.':'The wider photo could not be completed. Tap Retry or retake.',code:'IMAGE_INCOMPLETE'});
 }
};
module.exports.config={api:{bodyParser:false}};
