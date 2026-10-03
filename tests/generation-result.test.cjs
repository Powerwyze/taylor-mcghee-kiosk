const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),sharp=require('sharp');
test('flagged caricature remains the actual generated preview; provider failure never returns a plain-photo success',async()=>{
 const source=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).jpeg().toBuffer(),generated=await sharp({create:{width:100,height:100,channels:3,background:'red'}}).jpeg().toBuffer();
 const saved=[];let fail=false,rejectSource=false;const originalLoad=Module._load;
 Module._load=function(id,...args){if(id==='../lib/portrait-branding')return {brandPortrait:async b=>b};if(id==='../lib/http')return {sameOrigin:()=>true,upload:async()=>({bytes:source,field:n=>n==='role'?'executive':'caricature'}),reply:(r,s,d)=>{r.statusCode=s;r.end(JSON.stringify(d));}};
 if(id==='../lib/headshot')return {ROLES:{executive:{}},FORMATS:{caricature:{width:1024,height:1536}},imageModel:()=> 'gpt-image-2',checkSource:async()=>rejectSource?{usable:false,issue:'obscured_face',reason:'Keep your eyes, nose and mouth visible.'}:{usable:true},editCaricature:async()=>{if(fail)throw Error('provider');return generated;},formatOutput:async b=>b,checkLikeness:async()=>({appearance:'uncertain',composition:'review',issues:['crop']})};
 if(id==='../lib/storage')return {photoId:()=> 'synthetic-id',savePhotoRecord:async d=>saved.push(d)};return originalLoad.call(this,id,...args);};
 try{delete require.cache[require.resolve('../api/caricature')];const handler=require('../api/caricature');let body,status;const headers={};const res={set statusCode(s){status=s;},setHeader(k,v){headers[k]=v;},end(v){body=v;}};
 await handler({method:'POST'},res);assert.equal(status,200);assert.deepEqual(body,generated);assert.deepEqual(saved[0].jpeg,generated);assert.equal(headers['X-RPB-Path'],'ai-review');
 rejectSource=true;await handler({method:'POST'},res);assert.equal(status,422);assert.equal(JSON.parse(body).code,'RETAKE');assert.equal(JSON.parse(body).error,'Keep your eyes, nose and mouth visible.');assert.equal(saved.length,1);rejectSource=false;
 fail=true;await handler({method:'POST'},res);assert.equal(status,503);assert.equal(JSON.parse(body).code,'IMAGE_INCOMPLETE');assert.equal(saved.length,1);
 }finally{Module._load=originalLoad;delete require.cache[require.resolve('../api/caricature')];}
});