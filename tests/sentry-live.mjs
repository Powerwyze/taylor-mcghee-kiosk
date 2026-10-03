import {chromium} from 'playwright';import {readFile,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.env.KIOSK_URL;assert.ok(base);await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const report={url:base};let sessions=0,greetings=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},permissions:['camera','microphone']});
 const portrait='data:image/jpeg;base64,'+(await readFile('tests/fixtures/person.jpg')).toString('base64');
 await page.addInitScript(({portrait})=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.fixtureVisible=true;window.liveEvents=[];window.peers=[];
  navigator.mediaDevices.getUserMedia=async c=>{
   if(!c.video)return original(c);
   const image=new Image();image.src=portrait;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;const ctx=canvas.getContext('2d');
   const draw=()=>{ctx.fillStyle='#ddd';ctx.fillRect(0,0,640,640);if(window.fixtureVisible)ctx.drawImage(image,0,0,640,640);};draw();const timer=setInterval(draw,100);
   const stream=canvas.captureStream(10);stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;
  };
  const Native=RTCPeerConnection;
  window.RTCPeerConnection=class extends Native{
   constructor(...args){super(...args);window.peers.push(this);}
   addTrack(t,...a){if(t.kind==='audio')t.enabled=false;return super.addTrack(t,...a);}
   createDataChannel(...args){const c=super.createDataChannel(...args);c.addEventListener('message',({data})=>{try{window.liveEvents.push(JSON.parse(data));}catch{}});return c;}
  };
 },{portrait});
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/host-session')sessions++;});
 page.on('response',async r=>{if(new URL(r.url()).pathname==='/api/host-greeting'){try{greetings.push(await r.json());}catch{}}});
 await page.goto(base);await page.waitForFunction(()=>document.getElementById('face').dataset.avatar==='ready');
 await page.locator('#face').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.liveEvents.some(e=>e.type==='session.output_transcript.delta'),null,{timeout:65000});
 report.alreadyPresentStartsVoice=true;report.firstGreeting=greetings[0];assert.equal(greetings[0]?.personPresent,true);
 await page.waitForFunction(async()=>{for(const peer of window.peers){const stats=await peer.getStats();if([...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0))return true;}return false;},null,{timeout:15000});
 report.incomingAudio=true;await page.waitForTimeout(3000);
 report.firstSpokenText=await page.evaluate(()=>window.liveEvents.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join(''));
 await page.screenshot({path:'artifacts/sentry-greeting-mobile.png',fullPage:true});
 await page.waitForFunction(()=>window.liveEvents.filter(e=>e.type==='session.started').length>=2,null,{timeout:65000});
 report.continuousPresenceRearmed=true;
 report.protocolErrors=await page.evaluate(()=>window.liveEvents.filter(e=>e.type==='error').map(e=>({type:e.type,code:e.error?.code||e.code})));
 assert.deepEqual(report.protocolErrors,[]);
 await page.locator('#resetButton').click();const stoppedSessions=sessions;
 await page.evaluate(()=>window.fixtureVisible=false);await page.locator('#face').focus();await page.keyboard.press('Enter');
 await page.waitForTimeout(6500);assert.equal(sessions,stoppedSessions);report.emptySceneNoVoice=true;
 await page.locator('#face').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#avatarGestureStatus').textContent(),'Camera welcome off.');
 report.sessions=sessions;report.greetingCalls=greetings.length;
 await writeFile('artifacts/sentry-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
