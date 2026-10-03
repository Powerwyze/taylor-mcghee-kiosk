const sharp=require('sharp'),path=require('node:path');
async function brandPortrait(image,type){
 const m=await sharp(image).metadata(),width=m.width,height=m.height;
 const bw=width,bh=type==='expanded'?Math.max(64,Math.min(140,Math.round(width*.09))):type==='banner'?76:100;
 const padding=16,gap=28,slot=Math.floor((bw-padding*2-gap*2)/3);
 const layers=await Promise.all(['rpb.png','bpn.png','powerwyze.png'].map(async(name,i)=>{
  const input=await sharp(path.join(__dirname,'logos',name)).resize({width:slot,height:bh-padding*2,fit:'inside'}).png().toBuffer();
  const s=await sharp(input).metadata();
  return {input,left:padding+i*(slot+gap)+Math.floor((slot-s.width)/2),top:Math.floor((bh-s.height)/2)};
 }));
 const band=await sharp({create:{width:bw,height:bh,channels:3,background:'#FDEED0'}}).composite(layers).png().toBuffer();
 const base=type==='expanded'?await sharp(image).extend({bottom:bh,background:'#FDEED0'}).toBuffer():image;
 return sharp(base).composite([{input:band,left:0,top:type==='expanded'?height:height-bh}]).jpeg({quality:95}).toBuffer();
}
module.exports={brandPortrait};
