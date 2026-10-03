const sharp=require('sharp');
const FORMAT={id:'expanded',label:'LegacyCon photo booth',width:1920,height:1920};
// Preserve the complete camera frame. Only adjust light, color, and sharpness.
async function enhancePhoto(source){
 const jpeg=await sharp(source).rotate()
  .resize({width:FORMAT.width,height:FORMAT.height,fit:'inside',withoutEnlargement:true})
  .modulate({brightness:1.07,saturation:1.03})
  .sharpen({sigma:0.7})
  .jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();
 return {jpeg,mode:'natural-photo'};
}
module.exports={FORMAT,enhancePhoto};
