import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const source=await readFile('tests/fixtures/person.jpg'),report={};
for(const [name,base]of [['before','https://rpb-legacycon-kiosk.vercel.app'],['after','https://rpb-legacycon-kiosk-cqpu9kz8j-powerwyzes-projects.vercel.app']]){
 const form=new FormData();form.append('image',new Blob([source],{type:'image/jpeg'}),'fixture.jpg');form.append('role','executive');form.append('format','headshot');
 const start=performance.now();const r=await fetch(base+'/api/headshot',{method:'POST',body:form,signal:AbortSignal.timeout(240000)});const bytes=Buffer.from(await r.arrayBuffer());
 report[name]={status:r.status,seconds:Number(((performance.now()-start)/1000).toFixed(1)),timing:r.headers.get('server-timing'),appearance:r.headers.get('x-ai-appearance'),composition:r.headers.get('x-ai-composition')};
 if(r.ok)await writeFile('artifacts/'+name+'.jpg',bytes);
 await writeFile('artifacts/speed.json',JSON.stringify(report,null,2));
 assert.equal(r.status,200,name+' generation');
}
console.log(JSON.stringify(report));
