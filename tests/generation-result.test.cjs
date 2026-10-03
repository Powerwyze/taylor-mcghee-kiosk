const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),sharp=require('sharp');
test('composited output is stored and a failed composition never returns the source',async()=>{
 const source=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).jpeg().toBuffer();
 const expanded=await sharp({create:{width:1536,height:1152,channels:3,background:'red'}}).jpeg().toBuffer();
 const saved=[];let fail=false;const originalLoad=Module._load;
 Module._load=function(id,...args){
  if(id==='../lib/portrait-branding')return {brandPortrait:async b=>b};
  if(id==='../lib/http')return {sameOrigin:()=>true,upload:async()=>({bytes:source,maskBytes:Buffer.from('mask'),field:n=>n==='format'?'expanded':''}),reply:(r,s,d)=>{r.statusCode=s;r.end(JSON.stringify(d));}};
  if(id==='../lib/expanded-photo')return {FORMAT:{id:'expanded',width:1536,height:1152},imageModel:()=> 'mediapipe-selfie-segmenter',composePhoto:async()=>{if(fail)throw Error('composite');return expanded;}};
  if(id==='../lib/storage')return {photoId:()=> 'synthetic-id',savePhotoRecord:async d=>saved.push(d)};
  return originalLoad.call(this,id,...args);
 };
 try{delete require.cache[require.resolve('../api/expanded-photo')];const handler=require('../api/expanded-photo');let body,status;const headers={};const res={set statusCode(s){status=s;},setHeader(k,v){headers[k]=v;},end(v){body=v;}};
  await handler({method:'POST'},res);assert.equal(status,200);assert.deepEqual(body,expanded);assert.deepEqual(saved[0].jpeg,expanded);assert.equal(headers['X-RPB-Path'],'person-composite');
  fail=true;await handler({method:'POST'},res);assert.equal(status,503);assert.equal(JSON.parse(body).code,'IMAGE_INCOMPLETE');assert.equal(saved.length,1);
 }finally{Module._load=originalLoad;delete require.cache[require.resolve('../api/expanded-photo')];}
});
