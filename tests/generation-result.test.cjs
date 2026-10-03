const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),sharp=require('sharp');
test('the enhanced camera photo is stored with its sponsor footer',async()=>{
 const source=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).jpeg().toBuffer();
 const enhanced=await sharp({create:{width:100,height:100,channels:3,background:'red'}}).jpeg().toBuffer();
 const saved=[];let fail=false;const originalLoad=Module._load;
 Module._load=function(id,...args){
  if(id==='../lib/portrait-branding')return {brandPortrait:async (image,type)=>{assert.deepEqual(image,enhanced);assert.equal(type,'expanded');return image;}};
  if(id==='../lib/http')return {sameOrigin:()=>true,upload:async()=>({bytes:source,field:n=>n==='format'?'expanded':''}),reply:(r,s,d)=>{r.statusCode=s;r.end(JSON.stringify(d));}};
  if(id==='../lib/expanded-photo')return {FORMAT:{id:'expanded',width:1920,height:1920},enhancePhoto:async()=>{if(fail)throw Error('enhance');return {jpeg:enhanced,mode:'natural-photo'};}};
  if(id==='../lib/storage')return {photoId:()=> 'synthetic-id',savePhotoRecord:async d=>saved.push(d)};
  return originalLoad.call(this,id,...args);
 };
 try{delete require.cache[require.resolve('../api/expanded-photo')];const handler=require('../api/expanded-photo');let body,status;const headers={};const res={set statusCode(s){status=s;},setHeader(k,v){headers[k]=v;},end(v){body=v;}};
  await handler({method:'POST'},res);assert.equal(status,200);assert.deepEqual(body,enhanced);assert.deepEqual(saved[0].jpeg,enhanced);assert.equal(saved[0].look,'natural-photo');assert.equal(headers['X-RPB-Path'],'natural-photo');assert.equal(headers['X-Photo-Process'],'lighting-only');
  fail=true;await handler({method:'POST'},res);assert.equal(status,503);assert.equal(JSON.parse(body).code,'IMAGE_INCOMPLETE');assert.equal(saved.length,1);
 }finally{Module._load=originalLoad;delete require.cache[require.resolve('../api/expanded-photo')];}
});
