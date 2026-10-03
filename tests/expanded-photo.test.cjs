const {test}=require('node:test');const assert=require('node:assert/strict');const sharp=require('sharp');
const {FORMAT,composePhoto}=require('../lib/expanded-photo');
test('person pixels appear over generated backdrop without a rectangular original background',async()=>{
 const source=await sharp({create:{width:200,height:150,channels:3,background:'#22aa22'}}).composite([{input:await sharp({create:{width:60,height:120,channels:3,background:'#e02020'}}).png().toBuffer(),left:70,top:30}]).png().toBuffer();
 const alpha=Buffer.alloc(200*150,0);for(let y=30;y<150;y++)for(let x=70;x<130;x++)alpha[y*200+x]=255;
 const mask=await sharp(alpha,{raw:{width:200,height:150,channels:1}}).joinChannel(alpha,{raw:{width:200,height:150,channels:1}}).png().toBuffer().catch(async()=>{const rgba=Buffer.alloc(200*150*4);for(let i=0;i<alpha.length;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=255;rgba[i*4+3]=alpha[i]}return sharp(rgba,{raw:{width:200,height:150,channels:4}}).png().toBuffer()});
 const backdrop=await sharp({create:{width:FORMAT.width,height:FORMAT.height,channels:3,background:'#1020d0'}}).png().toBuffer();
 const output=await composePhoto(source,mask,{backdrop});const info=await sharp(output).metadata();assert.equal(info.width,FORMAT.width);assert.equal(info.height,FORMAT.height);
 const edge=await sharp(output).extract({left:5,top:5,width:1,height:1}).raw().toBuffer();assert.ok(edge[2]>edge[1]*2);
 const center=await sharp(output).extract({left:760,top:550,width:1,height:1}).raw().toBuffer();assert.ok(center[0]>center[2]);
});
