const {test}=require('node:test');const assert=require('node:assert/strict');const sharp=require('sharp');
const {enhancePhoto}=require('../lib/expanded-photo');
test('lighting pass brightens the complete camera frame without replacing its scene',async()=>{
 const source=await sharp({create:{width:800,height:450,channels:3,background:{r:45,g:35,b:50}}})
  .composite([{input:await sharp({create:{width:160,height:280,channels:3,background:{r:115,g:60,b:45}}}).png().toBuffer(),left:320,top:100}]).png().toBuffer();
 const {jpeg,mode}=await enhancePhoto(source);assert.equal(mode,'natural-photo');
 const m=await sharp(jpeg).metadata();assert.deepEqual([m.width,m.height],[800,450]);
 const before=await sharp(source).raw().toBuffer();const after=await sharp(jpeg).raw().toBuffer();
 const pixel=(data,x,y)=>[...data.subarray((y*800+x)*3,(y*800+x)*3+3)];
 const oldBackground=pixel(before,20,20),newBackground=pixel(after,20,20),newPerson=pixel(after,400,220);
 assert.ok(newBackground[0]>oldBackground[0],'room is brighter');assert.ok(newPerson[0]>newBackground[0]+40,'person remains in original position');
 assert.ok(pixel(after,20,430)[0]>oldBackground[0],'bottom of original background remains');
});
test('wide and tall photos keep every edge and their original aspect ratio',async()=>{
 for(const [width,height]of [[1600,900],[900,1600]]){
  const source=await sharp({create:{width,height,channels:3,background:'#32333a'}}).png().toBuffer();
  const {jpeg}=await enhancePhoto(source);const m=await sharp(jpeg).metadata();assert.deepEqual([m.width,m.height],[width,height]);
 }
});
