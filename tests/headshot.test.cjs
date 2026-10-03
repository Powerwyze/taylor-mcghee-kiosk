const {test}=require('node:test');const assert=require('node:assert/strict');
const {ROLES,promptFor}=require('../lib/headshot');const {liveSessionConfig}=require('../lib/legacy-host');
test('all seven selected roles preserve source identity and clothing',()=>{assert.equal(Object.keys(ROLES).length,7);for(const role of Object.keys(ROLES)){const p=promptFor(role);assert.match(p,/sole identity reference/);assert.match(p,/Keep their real expression and clothing/);assert.match(p,/No full body/);}assert.throws(()=>promptFor('madeup'));});
test('voice exact model and touch-only contact approval',()=>{const c=liveSessionConfig();assert.equal(c.model,'gpt-live-1');assert.equal(c.store,false);assert.ok(c.delegation.responses.tools.every(t=>!t.name.includes('confirm')&&!t.name.includes('claim')));});
test('claim requires explicit contact and likeness confirmations before reading storage',async()=>{const handler=require('../api/claim-photo');for(const body of [{phone:'2025550123',confirmed:false,likenessApproved:true},{phone:'2025550123',confirmed:true,likenessApproved:false},{phone:'invalid',confirmed:true,likenessApproved:true}]){let status,payload;await handler({method:'POST',headers:{host:'localhost'},body},{set statusCode(n){status=n;},setHeader(){},end(v){payload=JSON.parse(v);}});assert.equal(status,400);assert.match(payload.error,/Check/);}});

test('all three formats have distinct composition and exact final dimensions, including honest fallbacks',async()=>{
 const {FORMATS,formatOutput,promptFor}=require('../lib/headshot'),sharp=require('sharp');
 assert.deepEqual(Object.keys(FORMATS),['banner','profile','headshot']);
 assert.match(promptFor('tech','banner'),/right third/);assert.match(promptFor('tech','profile'),/circular/);assert.match(promptFor('tech','headshot'),/vertical/);
 const source=await sharp({create:{width:800,height:600,channels:3,background:'#557788'}}).jpeg().toBuffer();
 for(const [type,f] of Object.entries(FORMATS))for(const original of [true,false]){const out=await formatOutput(source,type,{original});const m=await sharp(out).metadata();assert.equal(m.width,f.width);assert.equal(m.height,f.height);}
 assert.throws(()=>promptFor('tech','invalid'));
});
test('image requests preserve chosen format and role through provider payload',async()=>{
 const originalFetch=global.fetch;process.env.OPENAI_API_KEY='test-only';
 try{const {editHeadshot,FORMATS}=require('../lib/headshot');for(const [type,f]of Object.entries(FORMATS)){global.fetch=async(url,options)=>{assert.equal(options.body.get('size'),f.apiSize);assert.equal(options.body.get('input_fidelity'),'high');assert.equal(options.body.get('prompt'),require('../lib/headshot').promptFor('community',type));return new Response(JSON.stringify({data:[{b64_json:'dGVzdA=='}]}),{status:200});};assert.equal((await editHeadshot(Buffer.from('test'),'community',type)).toString(),'test');}}finally{global.fetch=originalFetch;delete process.env.OPENAI_API_KEY;}
});
