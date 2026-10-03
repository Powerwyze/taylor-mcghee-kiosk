const sharp=require('sharp');
const {openaiRequest}=require('./openai-request');
const FORMAT={id:'expanded',label:'Expanded backdrop photo',width:1536,height:1152,apiSize:'1536x1152'};
function imageModel(){return process.env.OPENAI_PORTRAIT_MODEL||'gpt-image-2';}
function safeCode(code,status){return ['insufficient_quota','billing_hard_limit_reached','model_not_found','invalid_api_key','content_policy_violation','rate_limit_exceeded'].includes(code)?code:'provider_'+status;}
function outputText(data){return data.output_text||(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');}
async function visionJson(instructions,images,{signal,schema}={}){
 const response=await openaiRequest('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json'},signal:signal||AbortSignal.timeout(25000),body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',store:false,input:[{role:'user',content:[{type:'input_text',text:instructions},...images.map(image_url=>({type:'input_image',image_url,detail:'high'}))]}],text:{format:{type:'json_schema',name:'result',strict:true,schema}},max_output_tokens:650})});
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Object.assign(Error('The image check is unavailable.'),{code:safeCode(d.error?.code,response.status)});}
 return JSON.parse(outputText(await response.json()));
}
const asImage=b=>'data:image/jpeg;base64,'+b.toString('base64');
const SOURCE_MESSAGES={no_face:'Bring the guest into the camera view.',obscured_face:'Keep faces clearly visible.',unreadable_face:'Hold still and move toward a light.',document:'Use the photo camera; this looks like a document or card.'};
async function checkSource(image){
 const r=await visionJson('Check whether this is a usable photo booth image with one or more visible guests. Accept groups, natural clothing, an existing physical backdrop, uneven indoor light, a tilted camera and partial shoulders. Require at least one discernible face. Return no_face only if no guest is visible, obscured_face only if all faces are substantially hidden, unreadable_face only for severe blur or darkness, and document only if the frame is dominated by text or a card. Do not assess identity or whether the picture was taken live.',[asImage(image)],{schema:{type:'object',properties:{issue:{type:'string',enum:['none',...Object.keys(SOURCE_MESSAGES)]}},required:['issue'],additionalProperties:false}});
 return {usable:r.issue==='none',issue:r.issue,reason:SOURCE_MESSAGES[r.issue]||''};
}
async function prepareOutpaint(source){
 const photo=await sharp(source).rotate().resize({width:1120,height:920,fit:'inside'}).png().toBuffer();
 const m=await sharp(photo).metadata(),left=Math.floor((FORMAT.width-m.width)/2),top=Math.floor((FORMAT.height-100-m.height)/2);
 const clear={r:0,g:0,b:0,alpha:0};
 const image=await sharp({create:{width:FORMAT.width,height:FORMAT.height,channels:4,background:clear}}).composite([{input:photo,left,top}]).png().toBuffer();
 const solid=await sharp({create:{width:m.width,height:m.height,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).png().toBuffer();
 const mask=await sharp({create:{width:FORMAT.width,height:FORMAT.height,channels:4,background:clear}}).composite([{input:solid,left,top}]).png().toBuffer();
 return {image,mask,photo,left,top,width:m.width,height:m.height};
}
const BACKDROP_PROMPT='Extend the existing real photo booth backdrop into the transparent space around the supplied camera photo. Match the visible backdrop exactly in material, color, pattern, perspective, lighting, shadows and depth so the wider frame feels like one natural photograph taken at the same moment. Keep the original center photograph as the exact reference. Do not redraw, move, resize, stylize, beautify, or change any guest, face, hair, skin, pose, clothing, accessories, or visible backdrop inside the original rectangle. Do not invent additional people, bodies, clothing, logos, signs, text, props or a different location. Fill only the empty margins with a plausible continuation of the backdrop. Photorealistic, professional photo booth quality.';
async function editBackground(prepared){
 const form=new FormData();form.append('model',imageModel());form.append('image',new Blob([prepared.image],{type:'image/png'}),'wide-photo.png');form.append('mask',new Blob([prepared.mask],{type:'image/png'}),'background-mask.png');form.append('prompt',BACKDROP_PROMPT);if(imageModel().startsWith('gpt-image-1'))form.append('input_fidelity','high');form.append('quality','medium');form.append('output_format','jpeg');form.append('size',FORMAT.apiSize);form.append('n','1');
 const r=await openaiRequest('https://api.openai.com/v1/images/edits',{method:'POST',body:form,signal:AbortSignal.timeout(160000)});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(Error('Backdrop expansion is unavailable.'),{code:safeCode(d.error?.code,r.status)});}
 const item=(await r.json()).data?.[0];if(item?.b64_json)return Buffer.from(item.b64_json,'base64');throw Error('No expanded image returned.');
}
async function mergeOriginal(generated,prepared){
 const {data,info}=await sharp(prepared.photo).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const distance=Math.min(x,y,info.width-1-x,info.height-1-y);
  data[(y*info.width+x)*4+3]=Math.round(255*Math.min(1,distance/18));
 }
 const overlay=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 return sharp(generated).rotate().resize(FORMAT.width,FORMAT.height,{fit:'fill'}).composite([{input:overlay,left:prepared.left,top:prepared.top}]).jpeg({quality:95}).toBuffer();
}
async function reviewExpansion(source,result){
 return visionJson('Review a photo booth background expansion. The supplied original camera photo is preserved in the center of the wider output. Compare the guests and their clothing between source and output. Confirm that all visible guests keep the same face, clothes, pose and accessories, there are no extra or duplicated people, and the added margins continue the existing backdrop plausibly. Normal extra background is expected. Do not identify anyone or infer identity. Return only the listed categories.',[asImage(source),asImage(result)],{schema:{type:'object',properties:{appearance:{type:'string',enum:['consistent','changed','uncertain']},composition:{type:'string',enum:['pass','review']},issues:{type:'array',items:{type:'string',enum:['guest_changed','clothing_changed','extra_person','duplicate_person','backdrop_mismatch','seam','crop','uncertain']}}},required:['appearance','composition','issues'],additionalProperties:false}});
}
module.exports={FORMAT,imageModel,visionJson,checkSource,prepareOutpaint,editBackground,mergeOriginal,reviewExpansion,BACKDROP_PROMPT};
