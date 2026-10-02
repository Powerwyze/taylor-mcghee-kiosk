import {chromium} from 'playwright';import sharp from 'sharp';import {mkdir,writeFile,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.env.KIOSK_URL;if(!base)throw Error('KIOSK_URL required');
await mkdir('artifacts',{recursive:true});const report={};
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920},permissions:['camera','microphone']});
 await page.addInitScript(()=>{const Native=RTCPeerConnection;window.liveEvents=[];window.liveChannel=null;window.RTCPeerConnection=class extends Native{addTrack(t,...a){if(t.kind==='audio')t.enabled=false;return super.addTrack(t,...a);}createDataChannel(...a){const c=super.createDataChannel(...a);window.liveChannel=c;c.addEventListener('message',({data})=>{try{window.liveEvents.push(JSON.parse(data));}catch{}});return c;}};});
 await page.goto(base);await page.waitForFunction(()=>document.getElementById('face').dataset.avatar==='ready',null,{timeout:30000});report.avatar='3D loaded';
 await page.screenshot({path:'artifacts/live-home.png',fullPage:true});await page.locator('#face').screenshot({path:'artifacts/avatar-alone.png'});
 await page.locator('#voiceButton').click();
 try{
  await page.waitForFunction(()=>window.liveEvents.some(e=>e.type==='session.started'),null,{timeout:40000});report.voiceStarted=true;
  await page.waitForFunction(()=>window.liveEvents.some(e=>e.type==='session.output_transcript.delta'),null,{timeout:35000});report.spokenCaptions=true;
  const ask=text=>page.evaluate(text=>{window.liveChannel.send(JSON.stringify({type:'response.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}}));window.liveChannel.send(JSON.stringify({type:'response.create'}));},text);
  await ask('I do not have a business card. Please skip the card step.');
  await page.waitForFunction(()=>document.getElementById('kiosk').dataset.screen==='category',null,{timeout:30000});report.voiceSkipCard=true;
  await page.waitForTimeout(3000);
  await ask('I choose the Executive headshot style. Please select Executive, but do not take a photo yet.');
  await page.waitForFunction(()=>document.getElementById('kiosk').dataset.screen==='camera',null,{timeout:30000});report.voiceCategory=true;
  report.voiceErrors=await page.evaluate(()=>window.liveEvents.filter(e=>e.type==='error').map(e=>({code:e.error?.code||e.code})));
  await page.screenshot({path:'artifacts/live-voice-camera.png',fullPage:true});
 }catch{report.voiceFailure=await page.locator('#voiceStatus').textContent();}
 await page.evaluate(()=>{if(window.liveChannel?.readyState==='open')window.liveChannel.send(JSON.stringify({type:'session.close'}));});await page.waitForTimeout(700);await page.close();
 const card=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="white"/><g fill="black" font-family="sans-serif" font-size="58"><text x="80" y="130">Alex Sample</text><text x="80" y="240">Example Studio</text><text x="80" y="350">alex@example.com</text><text x="80" y="460">Mobile: 202-555-0123</text></g></svg>')).jpeg().toBuffer();
 const cf=new FormData();cf.append('image',new Blob([card],{type:'image/jpeg'}),'synthetic-card.jpg');
 const cr=await fetch(base+'/api/read-card',{method:'POST',body:cf});report.cardStatus=cr.status;
 if(cr.ok){const d=await cr.json();report.cardOCR=d.name==='Alex Sample'&&d.phone.replace(/\D/g,'').endsWith('2025550123')&&d.email==='alex@example.com';}
 const source=await readFile('tests/fixtures/person.jpg');
 const form=new FormData();form.append('image',new Blob([source],{type:'image/jpeg'}),'public-test-portrait.jpg');form.append('role','executive');
 const r=await fetch(base+'/api/headshot',{method:'POST',body:form});report.headshotStatus=r.status;
 if(r.ok){
  const image=Buffer.from(await r.arrayBuffer());await writeFile('artifacts/live-headshot.jpg',image);await writeFile('artifacts/source-fixture.jpg',source);
  report.headshotPath=r.headers.get('X-RPB-Path');report.editStatus=r.headers.get('X-AI-Edit');report.checkStatus=r.headers.get('X-AI-Check');report.notice=decodeURIComponent(r.headers.get('X-Photo-Notice')||'');const id=r.headers.get('X-Photo-Id'),claim=r.headers.get('X-Claim-Token');
  const post=(path,data)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const before=await post('/api/unlock',{id,phone:'2025550123'});report.unboundHidden=!before.ok;
  const invalid=await post('/api/claim-photo',{id,claim,phone:'2025550123',confirmed:true,likenessApproved:false});report.likenessGate=invalid.status===400;
  const bind=await post('/api/claim-photo',{id,claim,phone:'2025550123',confirmed:true,likenessApproved:true,name:'Synthetic test'});report.claimStatus=bind.status;
  const wrong=await post('/api/unlock',{id,phone:'2025550124'});report.wrongNumberHidden=wrong.status===401&&!((await wrong.json()).image);
  const right=await post('/api/unlock',{id,phone:'2025550123'});report.unlockStatus=right.status;report.unlockSuccess=right.ok&&Boolean((await right.json()).image);
  report.qr=(await fetch(base+'/api/qr?text='+encodeURIComponent(base+'/p/'+id))).ok;
 }else report.headshotError=(await r.json().catch(()=>({}))).code||'unavailable';
 await writeFile('artifacts/live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.equal(report.voiceStarted,true,'live voice startup');assert.equal(report.spokenCaptions,true);assert.equal(report.voiceSkipCard,true);assert.equal(report.voiceCategory,true);assert.deepEqual(report.voiceErrors,[]);assert.equal(report.cardOCR,true);assert.equal(report.editStatus,'success','real image generation succeeded');assert.ok(['passed','rejected'].includes(report.checkStatus),'independent check completed');assert.equal(report.headshotPath,report.checkStatus==='passed'?'ai-checked':'original','rejected likeness must use original');assert.equal(report.unlockSuccess,true);assert.equal(report.wrongNumberHidden,true);assert.equal(report.likenessGate,true);assert.equal(report.unboundHidden,true);
}finally{await browser.close();}
