const {brandPortrait}=require('../lib/portrait-branding');
const crypto=require('node:crypto'),sharp=require('sharp');
const {reply,sameOrigin,upload}=require('../lib/http');
const {FORMAT,imageModel,composePhoto}=require('../lib/expanded-photo');
const {photoId,savePhotoRecord}=require('../lib/storage');
const {hashToken}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to create your image.'});
 let stage='upload';const started=Date.now(),timings={};let tick=started;const mark=name=>{const now=Date.now();timings[name]=now-tick;tick=now;};
 try{
  const {bytes,maskBytes,field}=await upload(req);if(field('format')&&field('format')!==FORMAT.id)return reply(res,400,{error:'Choose the photo booth.'});
  const source=await sharp(bytes).rotate().jpeg({quality:94}).toBuffer();
  mark('prepare');stage='composite';const composed=await composePhoto(source,maskBytes);
  mark('composite');stage='branding';const final=await brandPortrait(composed.jpeg,FORMAT.id);
  mark('branding');stage='storage';const id=photoId(),claim=crypto.randomBytes(32).toString('base64url');
  await savePhotoRecord({id,jpeg:final,phoneHash:'',look:'generated-backdrop',claimHash:hashToken(claim)});
  mark('storage');console.info('image_timing',JSON.stringify({format:FORMAT.id,model:imageModel(),mode:composed.mode,...timings,total:Date.now()-started}));res.setHeader('Server-Timing',Object.entries(timings).map(([k,v])=>k+';dur='+v).join(', '));
  res.statusCode=200;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/jpeg');
  for(const [key,value]of Object.entries({'X-Photo-Id':id,'X-Claim-Token':claim,'X-RPB-Path':composed.mode,'X-Image-Format':FORMAT.id,'X-Image-Width':String(FORMAT.width),'X-Image-Height':String(FORMAT.height),'X-AI-Model':imageModel(),'X-AI-Edit':'pre-generated-backdrop-composite','X-AI-Check':composed.mode==='person-composite'?'person-mask':'original-safe','X-AI-Appearance':'original-pixels','X-AI-Composition':composed.mode==='person-composite'?'pass':'original-safe','X-Photo-Notice':encodeURIComponent(composed.mode==='person-composite'?'Check your photo before opening the QR code.':'We kept the complete camera photo so everyone stays visible. Check it before opening the QR code.')}))res.setHeader(key,value);
  res.end(final);
 }catch(e){console.warn('image_failure',JSON.stringify({stage,error:String(e.message||e)}));return reply(res,503,{error:stage==='composite'?'The photo could not be placed on the backdrop. Please retake it.':'The photo could not be completed. Please try again.',code:'IMAGE_INCOMPLETE'});}
};
module.exports.config={api:{bodyParser:false}};
