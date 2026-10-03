import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='https://rpb-legacycon-kiosk2.vercel.app';
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({permissions:['camera','microphone'],viewport:{width:1080,height:1920}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=RTCPeerConnection;window.voiceEvents=[];window.RTCPeerConnection=class extends Native{createDataChannel(...args){const channel=super.createDataChannel(...args);channel.addEventListener('message',event=>{try{window.voiceEvents.push(JSON.parse(event.data).type)}catch{}});return channel}}});
 await page.goto(base);await page.locator('#voiceButton').click();
 await page.waitForFunction(()=>window.voiceEvents.includes('session.started')||document.getElementById('voiceStatus').textContent.includes('unavailable'),null,{timeout:45000});
 const state=await page.evaluate(()=>({status:document.getElementById('voiceStatus').textContent,events:window.voiceEvents.slice(0,20),errors:[]}));
 console.log(JSON.stringify(state));assert.ok(state.events.includes('session.started'),'live AI voice session started');assert.deepEqual(errors,[]);
}finally{await browser.close();}
