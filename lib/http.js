const fs=require('node:fs/promises');
const fm=require('formidable');const formidable=fm.default||fm;
function reply(res,status,data){res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
function sameOrigin(req){const origin=req.headers.origin;return !origin||origin=== 'https://'+req.headers.host||origin==='http://'+req.headers.host;}
async function jsonBody(req){if(req.body&&typeof req.body==='object')return req.body;let raw='';for await(const part of req){raw+=part;if(raw.length>6500000)throw Error('Request too large');}return JSON.parse(raw||'{}');}
async function upload(req){
 const [fields,files]=await new Promise((resolve,reject)=>formidable({maxFileSize:8*1024*1024,maxFiles:2,allowEmptyFiles:false}).parse(req,(e,a,b)=>e?reject(e):resolve([a,b])));
 const file=Array.isArray(files.image)?files.image[0]:files.image;
 const mask=Array.isArray(files.mask)?files.mask[0]:files.mask;
 if(!file?.filepath)throw Error('A camera photo is required.');
 try {return {bytes:await fs.readFile(file.filepath),maskBytes:mask?.filepath?await fs.readFile(mask.filepath):null,field:n=>String(Array.isArray(fields[n])?fields[n][0]:fields[n]||'')};}
 finally{await Promise.all([file?.filepath,mask?.filepath].filter(Boolean).map(p=>fs.unlink(p).catch(()=>{})));}
}
module.exports={reply,sameOrigin,jsonBody,upload};
