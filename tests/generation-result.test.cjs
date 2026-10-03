const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),sharp=require('sharp');
test('flagged AI image remains the actual generated preview; provider failure never returns a plain-photo success',async()=>{
 const source=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).jpeg().toBuffer(),generated=await sharp({create:{width:100,height:100,channels:3,background:'red'}}).jpeg().toBuffer();
 const saved=[];let fail=false;const originalLoad=Module._load;
 Module._load=function(id,...args){if(id==='../lib/http')return {sameOrigin:()=>true,upload:async()=>({bytes:source,field:n=>n==='role'?'executive':'banner'}),reply:(r,s,d)=>{r.statusCode=s;r.end(JSON.stringify(d));}};
 if(id==='../lib/headshot')return {ROLES:{executive:{}},FORMATS:{banner:{width:1584,height:396}},imageModel:()=> 'gpt-image-2',checkSource:async()=>({usable:true}),editHeadshot:async()=>{if(fail)throw Error('provider');return generated;},formatOutput:async b=>b,checkLikeness:async()=>({appearance:'uncertain',composition:'review',issues:['crop']})};
 if(id==='../lib/storage')return {photoId:()=> 'synthetic-id',savePhotoRecord:async d=>saved.push(d)};return originalLoad.call(this,id,...args);};
 try{delete require.cache[require.resolve('../api/headshot')];const handler=require('../api/headshot');let body,status;const headers={};const res={set statusCode(s){status=s;},setHeader(k,v){headers[k]=v;},end(v){body=v;}};
 await handler({method:'POST'},res);assert.equal(status,200);assert.deepEqual(body,generated);assert.deepEqual(saved[0].jpeg,generated);assert.equal(headers['X-RPB-Path'],'ai-review');
 fail=true;await handler({method:'POST'},res);assert.equal(status,503);assert.equal(JSON.parse(body).code,'IMAGE_INCOMPLETE');assert.equal(saved.length,1);
 }finally{Module._load=originalLoad;delete require.cache[require.resolve('../api/headshot')];}
});