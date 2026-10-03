const {brandPortrait}=require('../lib/portrait-branding');
const crypto=require('node:crypto'),sharp=require('sharp');
const {reply,sameOrigin,upload}=require('../lib/http');
const {FORMAT,enhancePhoto}=require('../lib/expanded-photo');
const {photoId,savePhotoRecord}=require('../lib/storage');
const {hashToken}=require('../lib/phone');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Open this kiosk to create your image.'});
 let stage='upload';const started=Date.now(),timings={};let tick=started;const mark=name=>{const now=Date.now();timings[name]=now-tick;tick=now;};
 try{
  const {bytes,field}=await upload(req);if(field('format')&&field('format')!==FORMAT.id)return reply(res,400,{error:'Choose the photo booth.'});
  stage='enhance';const enhanced=(await enhancePhoto(bytes)).jpeg;
  mark('enhance');stage='branding';const final=await brandPortrait(enhanced,FORMAT.id);
  mark('branding');const finalSize=await sharp(final).metadata();stage='storage';const id=photoId(),claim=crypto.randomBytes(32).toString('base64url');
  await savePhotoRecord({id,jpeg:final,phoneHash:'',look:'natural-photo',claimHash:hashToken(claim)});
  mark('storage');console.info('image_timing',JSON.stringify({format:FORMAT.id,mode:'natural-photo',...timings,total:Date.now()-started}));res.setHeader('Server-Timing',Object.entries(timings).map(([k,v])=>k+';dur='+v).join(', '));
  res.statusCode=200;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/jpeg');
  for(const [key,value]of Object.entries({'X-Photo-Id':id,'X-Claim-Token':claim,'X-RPB-Path':'natural-photo','X-Image-Format':FORMAT.id,'X-Image-Width':String(finalSize.width),'X-Image-Height':String(finalSize.height),'X-Photo-Process':'lighting-only','X-Photo-Notice':encodeURIComponent('Review your photo before opening the QR code.')}))res.setHeader(key,value);
  res.end(final);
 }catch(e){console.warn('image_failure',JSON.stringify({stage,error:String(e.message||e)}));return reply(res,503,{error:'The photo could not be completed. Please try again.',code:'IMAGE_INCOMPLETE'});}
};
module.exports.config={api:{bodyParser:false}};
