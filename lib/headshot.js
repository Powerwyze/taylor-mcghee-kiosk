const {openaiRequest}=require('./openai-request');
const ROLES={
 entrepreneur:{label:'Entrepreneur',scene:'A soft warm studio background with a very subtle contemporary workspace impression. Approachable founder headshot.'},
 tech:{label:'Tech enthusiast',scene:'A clean deep-navy studio background with a restrained cool rim light. Modern, approachable technology-community headshot. No devices or costumes.'},
 vc:{label:'VC',scene:'A quietly refined neutral studio backdrop with soft daylight. Professional investment-community headshot. No wealth props.'},
 law:{label:'Law firm',scene:'A warm charcoal studio backdrop, subtle formal editorial lighting. Professional legal-industry headshot. No robes, gavels, scales or invented credentials.'},
 bluecollar:{label:'Blue collar',scene:'A dignified warm-neutral studio backdrop with natural daylight. Skilled-trades professional headshot. Keep the guest clothing; do not add hard hats, tools, uniforms or stereotypes.'},
 executive:{label:'Executive',scene:'An elegant slate studio background and soft directional daylight. Confident leadership headshot.'},
 community:{label:'Community leader',scene:'A warm, welcoming softly blurred natural studio backdrop. Approachable community-leadership headshot.'}
};
function promptFor(role){
 if(!ROLES[role])throw Error('Choose a headshot category.');
 return 'Edit the supplied camera photograph conservatively into a premium professional HEAD-AND-SHOULDERS HEADSHOT of exactly the ONE person in the source. The source photograph is the sole identity reference. Keep the exact facial geometry, eye shape, nose, mouth, jaw, skin tone, age, hairline, hairstyle, hair texture, facial hair, glasses and distinguishing features. Keep their real expression and clothing. Do NOT invent another face, beautify, smooth away skin texture, slim, age, lighten skin, change ethnicity, add hair or remove accessories. Keep face pixels and facial detail as close to the source as possible. Only improve background and subtle photographic lighting. Crop chest-up with room around the head. No full body, no skyline, no props, no text, no logos. Category is a guest-selected visual preference, not a claim about occupation. '+ROLES[role].scene;
}
function outputText(data){return data.output_text || (data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');}
async function visionJson(instructions,images,{signal,schema}={}){
 const response=await openaiRequest('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json'},signal:signal||AbortSignal.timeout(25000),body:JSON.stringify({
 model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',store:false,
 input:[{role:'user',content:[{type:'input_text',text:instructions},...images.map(image_url=>({type:'input_image',image_url,detail:'high'}))]}],
 text:{format:{type:'json_schema',name:'result',strict:true,schema}},max_output_tokens:650
 })});
 if(!response.ok)throw Error('The image check is unavailable.');
 return JSON.parse(outputText(await response.json()));
}
const asImage=b=>'data:image/jpeg;base64,'+b.toString('base64');
async function checkSource(image){
 const r=await visionJson('Check this camera photo for a professional solo headshot. Return usable true only if exactly one real person has a clear, large, unobstructed face with adequate light. Reject business cards, printed portraits, multiple people, tiny/blurry/cut-off faces. Do not identify the person. Give a short neutral capture instruction if unusable.',
 [asImage(image)],{schema:{type:'object',properties:{usable:{type:'boolean'},reason:{type:'string'}},required:['usable','reason'],additionalProperties:false}});
 return r;
}
async function checkLikeness(source,result){
 const r=await visionJson('Compare camera source (first) and edited headshot (second). Do not identify or name anyone. Conservatively check that exactly one person remains and facial geometry, skin tone, hairline, hairstyle, facial hair, glasses and approximate age are preserved, with a head-and-shoulders crop. Return matches false for visible identity drift, uncertainty, an extra person or distorted features. This is a visual quality check, not identity authentication.',
 [asImage(source),asImage(result)],{schema:{type:'object',properties:{matches:{type:'boolean'},reason:{type:'string'}},required:['matches','reason'],additionalProperties:false}});
 return r.matches===true;
}
async function editHeadshot(source,role){
 const form=new FormData();form.append('model',process.env.OPENAI_IMAGE_MODEL||'gpt-image-1');form.append('image',new Blob([source],{type:'image/jpeg'}),'source.jpg');
 form.append('prompt',promptFor(role));form.append('input_fidelity','high');form.append('quality','high');form.append('size','1024x1536');form.append('n','1');
 const signal=AbortSignal.timeout(110000);
 const r=await openaiRequest('https://api.openai.com/v1/images/edits',{method:'POST',body:form,signal});
 if(!r.ok)throw Error('Headshot editing is unavailable.');
 const item=(await r.json()).data?.[0];
 if(item?.b64_json)return Buffer.from(item.b64_json,'base64');
 throw Error('No headshot returned.');
}
module.exports={ROLES,promptFor,visionJson,checkSource,checkLikeness,editHeadshot};
