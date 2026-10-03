const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp'),fs=require('node:fs');const {brandPortrait}=require('../lib/portrait-branding');
test('both real logo assets are embedded without changing export dimensions',async()=>{
 fs.mkdirSync('artifacts',{recursive:true});
 for(const [type,width,height]of [['banner',1584,396],['profile',1024,1024],['headshot',1024,1536]]){
 const src=await sharp({create:{width,height,channels:3,background:'#335577'}}).jpeg().toBuffer();
 const out=await brandPortrait(src,type),m=await sharp(out).metadata();assert.equal(m.width,width);assert.equal(m.height,height);assert.notDeepEqual(out,src);
 fs.writeFileSync('artifacts/branding-'+type+'.jpg',out);
 }
});