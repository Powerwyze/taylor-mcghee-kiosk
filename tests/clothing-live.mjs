import {readFile,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});const source=await readFile('tests/fixtures/person.jpg');await writeFile('artifacts/source.jpg',source);
const report=[];
for(const format of ['banner','profile','headshot']){
 const form=new FormData();form.append('image',new Blob([source],{type:'image/jpeg'}),'public-portrait-fixture.jpg');form.append('role','bluecollar');form.append('format',format);
 const r=await fetch(process.env.KIOSK_URL+'/api/headshot',{method:'POST',body:form,signal:AbortSignal.timeout(240000)});const bytes=Buffer.from(await r.arrayBuffer());
 const row={format,status:r.status,appearance:r.headers.get('x-ai-appearance'),composition:r.headers.get('x-ai-composition'),notice:decodeURIComponent(r.headers.get('x-photo-notice')||'')};report.push(row);
 if(r.ok)await writeFile('artifacts/'+format+'.jpg',bytes);
 await writeFile('artifacts/clothing-report.json',JSON.stringify(report,null,2));assert.equal(r.status,200);
}
console.log(JSON.stringify(report));
