const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const crypto=require('node:crypto');
test('approved photo creates QR capability without a phone and supports direct download',async()=>{
 const original=Module._load;const hash=value=>crypto.createHash('sha256').update(value).digest('hex');let meta={id:'testphoto123',claimHash:hash('valid-claim-token-1234567890'),viewHash:'',approvedAt:''};
 Module._load=function(id,...args){if(id==='../lib/storage')return {loadMeta:async()=>meta,writeMeta:async(_id,value)=>{meta={...value}},readImageForMeta:async()=>Buffer.from('photo')};if(id==='../lib/phone')return {hashToken:hash,sameHex:(a,b)=>a===b};if(id==='../lib/http')return {sameOrigin:()=>true,jsonBody:async req=>req.body,reply:(res,status,data)=>{res.statusCode=status;res.body=data;return data}};return original.call(this,id,...args)};
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}});
 try{for(const p of ['../api/claim-photo','../api/download','../api/image'])delete require.cache[require.resolve(p)];const claim=require('../api/claim-photo'),download=require('../api/download'),image=require('../api/image');
  let res=response();await claim({method:'POST',body:{id:meta.id,claim:'valid-claim-token-1234567890',likenessApproved:false}},res);assert.equal(res.statusCode,400);assert.equal(meta.viewHash,'');
  res=response();await claim({method:'POST',body:{id:meta.id,claim:'valid-claim-token-1234567890',likenessApproved:true}},res);assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.ok(meta.approvedAt);assert.ok(meta.viewHash);assert.equal(res.body.phone,undefined);const token=res.body.viewToken;
  res=response();await download({url:'/api/download?id='+meta.id+'&token=wrong'},res);assert.equal(res.statusCode,404);
  res=response();await download({url:'/api/download?id='+meta.id+'&token='+token},res);assert.equal(res.statusCode,200);assert.match(res.body,/Download photo/);assert.doesNotMatch(res.body,/Mobile number|Confirm your number/);
  res=response();await image({url:'/api/image?id='+meta.id+'&token='+token+'&download=1'},res);assert.equal(res.statusCode,200);assert.match(res.headers['Content-Disposition'],/attachment/);assert.deepEqual(res.body,Buffer.from('photo'));
 }finally{Module._load=original;for(const p of ['../api/claim-photo','../api/download','../api/image'])delete require.cache[require.resolve(p)];}
});
