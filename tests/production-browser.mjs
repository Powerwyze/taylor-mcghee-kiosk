import {chromium} from 'playwright';import {mkdir,readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base='https://rpb-legacycon-kiosk.vercel.app';await mkdir('artifacts',{recursive:true});
const health=await (await fetch(base+'/api/health')).json();assert.equal(health.flow,'blueprint-headshot-card-qr-v2');assert.equal(health.quality,'high');
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});const result={publicURL:base,flow:health.flow};
try{const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);await page.waitForFunction(()=>document.getElementById('face').dataset.avatar==='ready');await page.screenshot({path:'artifacts/production-mobile.png',fullPage:true});
await page.setViewportSize({width:1080,height:1920});await page.screenshot({path:'artifacts/production-kiosk.png',fullPage:true});
assert.deepEqual(errors,[]);result.avatar='3D loaded';result.browserErrors=errors;
const frame='data:image/jpeg;base64,'+(await readFile('tests/fixtures/person.jpg')).toString('base64');
const greeting=await fetch(base+'/api/host-greeting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frame})});result.greetingStatus=greeting.status;
const data=await greeting.json();result.greetingVerified=greeting.ok&&data.personPresent===true&&typeof data.greeting==='string'&&data.greeting.length>0;
await writeFile('artifacts/production-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.equal(result.greetingVerified,true);
}finally{await browser.close();}
