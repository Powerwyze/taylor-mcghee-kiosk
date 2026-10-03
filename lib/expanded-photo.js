const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const FORMAT={id:'expanded',label:'LegacyCon photo booth',width:1536,height:1152};
const BACKDROP_PATH=path.join(__dirname,'../public/assets/legacycon-ai-backdrop.png');
function imageModel(){return 'mediapipe-selfie-segmenter + generated LegacyCon backdrop';}
async function composePhoto(source,mask,{backdrop}={}){
 const photo=await sharp(source).rotate().ensureAlpha().png().toBuffer();
 const size=await sharp(photo).metadata(),maskSize=await sharp(mask).metadata();
 if(size.width!==maskSize.width||size.height!==maskSize.height||!maskSize.hasAlpha)throw Error('The person mask does not match the captured photo.');
 const stats=await sharp(mask).extractChannel(3).stats();
 if(stats.channels[0].mean<2)throw Error('No guest was found in the photo. Please retake it.');
 const isolated=await sharp(photo).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 const subject=await sharp(isolated).resize({width:1240,height:1060,fit:'inside',withoutEnlargement:false}).png().toBuffer();
 const guest=await sharp(subject).metadata();
 const background=await sharp(backdrop||await fs.readFile(BACKDROP_PATH)).resize(FORMAT.width,FORMAT.height,{fit:'cover'}).ensureAlpha().toBuffer();
 const left=Math.floor((FORMAT.width-guest.width)/2),top=FORMAT.height-72-guest.height;
 return sharp(background).composite([{input:subject,left,top}]).jpeg({quality:93,chromaSubsampling:'4:4:4'}).toBuffer();
}
module.exports={FORMAT,imageModel,composePhoto};
