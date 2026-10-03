const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const FORMAT={id:'expanded',label:'LegacyCon photo booth',width:1536,height:1152};
const BACKDROP_PATH=path.join(__dirname,'../public/assets/legacycon-ai-backdrop.png');
function imageModel(){return 'mediapipe-deeplab-person + generated LegacyCon backdrop';}
async function safeOriginal(source){return sharp(source).rotate().resize(FORMAT.width,FORMAT.height,{fit:'cover',position:'centre'}).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();}
function regionMean(alpha,w,h,x0,y0,x1,y1){let total=0,count=0;for(let y=Math.floor(y0*h);y<Math.ceil(y1*h);y++)for(let x=Math.floor(x0*w);x<Math.ceil(x1*w);x++){total+=alpha[y*w+x];count++;}return total/Math.max(1,count)/255;}
async function verifiedMask(mask,w,h){
 if(!mask)return null;
 try{
  const m=await sharp(mask).metadata();if(m.width!==w||m.height!==h||!m.hasAlpha)return null;
  const alpha=await sharp(mask).extractChannel(3).raw().toBuffer();
  const corners=[[0,0,.08,.08],[.92,0,1,.08],[0,.92,.08,1],[.92,.92,1,1]].map(v=>regionMean(alpha,w,h,...v));
  const edge=corners.reduce((a,b)=>a+b,0)/4,center=regionMean(alpha,w,h,.3,.12,.7,.76);
  if((edge>.57&&center<edge-.16)||corners.filter(x=>x>.75).length>=3){for(let i=0;i<alpha.length;i++)alpha[i]=255-alpha[i];}
  let opaque=0;for(const a of alpha)if(a>120)opaque++;
  const coverage=opaque/alpha.length;
  const correctedCorners=[[0,0,.08,.08],[.92,0,1,.08],[0,.92,.08,1],[.92,.92,1,1]].map(v=>regionMean(alpha,w,h,...v));
  if(coverage<.008||coverage>.72||correctedCorners.filter(x=>x>.65).length>=2)return null;
  const rgba=Buffer.alloc(alpha.length*4);for(let i=0;i<alpha.length;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=255;rgba[i*4+3]=alpha[i];}
  return sharp(rgba,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
 }catch{return null;}
}
async function composePhoto(source,mask,{backdrop}={}){
 const photo=await sharp(source).rotate().ensureAlpha().png().toBuffer();const size=await sharp(photo).metadata();
 const safeMask=await verifiedMask(mask,size.width,size.height);
 if(!safeMask)return {jpeg:await safeOriginal(source),mode:'original-safe'};
 const isolated=await sharp(photo).composite([{input:safeMask,blend:'dest-in'}]).png().toBuffer();
 const subject=await sharp(isolated).resize({width:1240,height:1060,fit:'inside',withoutEnlargement:false}).png().toBuffer();const guest=await sharp(subject).metadata();
 const background=await sharp(backdrop||await fs.readFile(BACKDROP_PATH)).resize(FORMAT.width,FORMAT.height,{fit:'cover'}).ensureAlpha().toBuffer();
 const left=Math.floor((FORMAT.width-guest.width)/2),top=FORMAT.height-72-guest.height;
 return {jpeg:await sharp(background).composite([{input:subject,left,top}]).jpeg({quality:93,chromaSubsampling:'4:4:4'}).toBuffer(),mode:'person-composite'};
}
module.exports={FORMAT,imageModel,composePhoto,verifiedMask};
