import sharp from 'sharp';import {readFile,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const source=await readFile('tests/fixtures/person.jpg');
const main=await sharp(source).resize(640,800,{fit:'cover'}).toBuffer(),small=await sharp(source).resize(96,120).toBuffer();
const crowded=await sharp({create:{width:960,height:800,channels:3,background:'#b8b1a0'}}).composite([{input:small,left:820,top:280},{input:main,left:130,top:0}]).jpeg().toBuffer();
const pair=await sharp({create:{width:1280,height:800,channels:3,background:'#b8b1a0'}}).composite([{input:main,left:0,top:0},{input:main,left:640,top:0}]).jpeg().toBuffer();
const report=[];
for(const [name,bytes,ok]of [['solo',source,true],['background-bystander',crowded,true],['two-foreground',pair,false]]){
 await writeFile('artifacts/'+name+'.jpg',bytes);
 const f=new FormData();f.append('image',new Blob([bytes],{type:'image/jpeg'}),'test.jpg');f.append('role','executive');f.append('format','headshot');f.append('validateOnly','true');
 const r=await fetch(process.env.KIOSK_URL+'/api/headshot',{method:'POST',body:f});const d=await r.json();report.push({name,status:r.status,...d});await writeFile('artifacts/source-report.json',JSON.stringify(report,null,2));
 assert.equal(r.ok,ok,name);if(ok)assert.equal(d.generationStarted,false);else assert.equal(d.issue,'multiple_people');
}
console.log(JSON.stringify(report));
