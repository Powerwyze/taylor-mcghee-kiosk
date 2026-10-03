const {openaiRequest}=require('./openai-request');
function imageModel(){return process.env.OPENAI_PORTRAIT_MODEL||'gpt-image-2';}
function safeCode(code,status){return ['insufficient_quota','billing_hard_limit_reached','model_not_found','invalid_api_key','content_policy_violation','rate_limit_exceeded'].includes(code)?code:'provider_'+status;}
const ROLES={
 entrepreneur:{label:'Founder Spark',scene:'A warm modern studio with subtle creative business energy, gold highlights and a tailored blazer.'},
 tech:{label:'Tech Trailblazer',scene:'A deep navy studio with playful geometric light shapes and smart casual tailored layers. No gadgets or costume.'},
 vc:{label:'Deal Maker',scene:'A refined editorial studio with soft gold light, understated business attire and a confident welcoming pose. No wealth props.'},
 law:{label:'Legal Leader',scene:'A warm charcoal editorial background and polished professional clothing. No robes, gavels, scales or invented credentials.'},
 bluecollar:{label:'Master Maker',scene:'A warm neutral studio and crisp collared work shirt or refined overshirt. No hard hats, tools, uniforms or stereotypes.'},
 executive:{label:'Executive Energy',scene:'An elegant slate studio with soft directional light, polished tailoring and an upbeat leadership feel.'},
 community:{label:'Community Connector',scene:'A bright welcoming studio with subtle colorful shapes and comfortable professional layers.'}
};

const FORMATS={
 caricature:{label:'Big head caricature',width:1024,height:1536,apiSize:'1024x1536',composition:'Vertical poster composition. Make the head delightfully oversized, about twice natural proportion and the clear focus of the image. Show a small upper body and shoulders in polished professional clothing. Keep the entire hairstyle, ears, chin and shoulders inside the frame with comfortable space around the head. Leave the bottom 12 percent quiet for a separate brand strip.'}
};
function getFormat(id='caricature'){if(!Object.hasOwn(FORMATS,id))throw Error('Choose an image type.');return FORMATS[id];}
async function formatOutput(image,type='caricature',{original=false}={}){
 const sharp=require('sharp'),f=getFormat(type);
 if(original){
  const photo=await sharp(image).rotate().resize({width:f.width,height:f.height,fit:'inside'}).jpeg({quality:95}).toBuffer();
  const m=await sharp(photo).metadata();
  return sharp({create:{width:f.width,height:f.height,channels:3,background:'#303b49'}}).composite([{input:photo,left:Math.floor((f.width-m.width)/2),top:Math.floor((f.height-m.height)/2)}]).jpeg({quality:95}).toBuffer();
 }
 return sharp(image).rotate().resize(f.width,f.height,{fit:'cover',position:'centre'}).jpeg({quality:95}).toBuffer();
}

function promptFor(role,type='caricature'){
 const format=getFormat(type);
 if(!ROLES[role])throw Error('Choose a caricature style.');
 return 'Transform the supplied camera photograph of exactly ONE person into a premium, fun, professional big-head cartoon caricature. The source photograph is the sole identity reference. This must look like a clearly illustrated editorial character, not a photograph or ordinary headshot. Make the head visibly oversized, with a small upper body, playful expressive linework, rich color, clean shapes and tasteful depth. Preserve recognizable identity cues: skin tone, age, eye shape, nose, mouth, hairstyle and hair texture, facial hair, glasses, accessories, expression and distinctive features. Exaggerate proportions warmly and respectfully without mocking appearance, changing ethnicity, lightening skin, beautifying, smoothing away age, inventing hair, or adding people. Dress the person in polished professional clothing appropriate to the chosen visual style while respecting visible cultural or religious attire. This is a self-selected style, not a claim about their occupation. Use a crisp, premium illustration finish suitable for a keepsake from RPB Law Firm at LegacyCon. No text, logos, watermarks, costumes, legal symbols or stereotypes. '+ROLES[role].scene+' '+format.composition;
}
function outputText(data){return data.output_text || (data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');}
async function visionJson(instructions,images,{signal,schema}={}){
 const response=await openaiRequest('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json'},signal:signal||AbortSignal.timeout(25000),body:JSON.stringify({
 model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',store:false,
 input:[{role:'user',content:[{type:'input_text',text:instructions},...images.map(image_url=>({type:'input_image',image_url,detail:'high'}))]}],
 text:{format:{type:'json_schema',name:'result',strict:true,schema}},max_output_tokens:650
 })});
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Object.assign(Error('The image check is unavailable.'),{code:safeCode(d.error?.code,response.status)});}
 return JSON.parse(outputText(await response.json()));
}
const asImage=b=>'data:image/jpeg;base64,'+b.toString('base64');
const SOURCE_MESSAGES={no_face:'Bring your face into the camera view.',multiple_people:'Take this photo with just one person in view.',obscured_face:'Keep your eyes, nose and mouth visible.',unreadable_face:'Hold the phone still and move toward a light.',document:'Use the photo camera for your portrait; this image appears to be a document or card.'};
async function checkSource(image){
 const r=await visionJson('Assess portrait usability only. Accept an image containing one prominent person whose eyes, nose and mouth are discernible. Normal indoor light, uneven light, tilted/low-angle selfies, natural expressions, close framing, partial hair or shoulders outside the frame and non-studio backgrounds are acceptable. Do not require studio quality. Do not assess whether this is a live camera capture, whether the image is original, or who the person is. A photograph is valid regardless of its photographic style or familiarity. Return none if usable. Return no_face for no person, multiple_people for multiple foreground people, obscured_face only when core facial features are substantially hidden, unreadable_face only for severe blur/darkness that prevents reading facial detail, document only if the image is dominated by a business-card/document layout with text rather than a prominent person.',
 [asImage(image)],{schema:{type:'object',properties:{issue:{type:'string',enum:['none',...Object.keys(SOURCE_MESSAGES)]}},required:['issue'],additionalProperties:false}});
 if(r.issue!=='none'&&!Object.hasOwn(SOURCE_MESSAGES,r.issue))throw Error('Invalid source check.');
 return {usable:r.issue==='none',issue:r.issue,reason:SOURCE_MESSAGES[r.issue]||''};
}
async function checkLikeness(source,result,type='caricature'){
 getFormat(type);
 return visionJson('Review a deliberately stylized big-head cartoon caricature, without identifying or naming the person. Compare recognizable cues from the source: skin tone, hairstyle and texture, facial hair, glasses, eye/nose/mouth traits, expression and accessories. The oversized head, illustrated rendering, simplified skin detail and small body are intended and must NOT be marked as an identity or anatomy error. Report appearance as consistent, changed or uncertain. Separately check that there is one person, the whole enlarged head and hair are visible, the face is unobstructed, and the illustration is usable as a vertical keepsake. The bottom brand area may be quiet. Return only the enumerated issue categories, with no names or inferred identity.',
 [asImage(source),asImage(result)],{schema:{type:'object',properties:{appearance:{type:'string',enum:['consistent','changed','uncertain']},composition:{type:'string',enum:['pass','review']},issues:{type:'array',items:{type:'string',enum:['facial_features','hair','skin_tone','accessories','crop','anatomy','extra_person','composition','uncertain']}}},required:['appearance','composition','issues'],additionalProperties:false}});
}
async function editCaricature(source,role,type='caricature'){
 const format=getFormat(type);
 const form=new FormData();form.append('model',imageModel());form.append('image',new Blob([source],{type:'image/jpeg'}),'source.jpg');
 form.append('prompt',promptFor(role,type));if(imageModel().startsWith('gpt-image-1'))form.append('input_fidelity','high');form.append('quality','medium');form.append('output_format','jpeg');form.append('size',format.apiSize);form.append('n','1');
 const signal=AbortSignal.timeout(160000);
 const r=await openaiRequest('https://api.openai.com/v1/images/edits',{method:'POST',body:form,signal});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(Error('Caricature editing is unavailable.'),{code:safeCode(d.error?.code,r.status)});}
 const item=(await r.json()).data?.[0];
 if(item?.b64_json)return Buffer.from(item.b64_json,'base64');
 throw Error('No caricature returned.');
}
module.exports={imageModel,FORMATS,getFormat,formatOutput,ROLES,promptFor,visionJson,checkSource,checkLikeness,editCaricature};
