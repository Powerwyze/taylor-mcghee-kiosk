const {openaiRequest}=require('./openai-request');
function safeCode(code,status){return ['insufficient_quota','billing_hard_limit_reached','model_not_found','invalid_api_key','content_policy_violation','rate_limit_exceeded'].includes(code)?code:'provider_'+status;}
const ROLES={
 entrepreneur:{label:'Entrepreneur',scene:'A soft warm studio background with a very subtle contemporary workspace impression. Approachable founder headshot.'},
 tech:{label:'Tech enthusiast',scene:'A clean deep-navy studio background with a restrained cool rim light. Modern, approachable technology-community headshot. No devices or costumes.'},
 vc:{label:'VC',scene:'A quietly refined neutral studio backdrop with soft daylight. Professional investment-community headshot. No wealth props.'},
 law:{label:'Law firm',scene:'A warm charcoal studio backdrop, subtle formal editorial lighting. Professional legal-industry headshot. No robes, gavels, scales or invented credentials.'},
 bluecollar:{label:'Blue collar',scene:'A dignified warm-neutral studio backdrop with natural daylight. Skilled-trades professional headshot. Keep the guest clothing; do not add hard hats, tools, uniforms or stereotypes.'},
 executive:{label:'Executive',scene:'An elegant slate studio background and soft directional daylight. Confident leadership headshot.'},
 community:{label:'Community leader',scene:'A warm, welcoming softly blurred natural studio backdrop. Approachable community-leadership headshot.'}
};

const FORMATS={
 banner:{label:'LinkedIn banner',width:1584,height:396,apiSize:'1536x1024',composition:'Create a wide LinkedIn cover composition. The final image crops the central horizontal 4:1 strip of this landscape canvas. Put the complete head and shoulders ONLY in the right third, entirely inside the middle 38 percent of canvas height. Keep the full face and hair away from all crop boundaries. The left two thirds is quiet complementary background, clear of people, objects, lettering and logos. No full body.'},
 profile:{label:'Profile picture',width:1024,height:1024,apiSize:'1024x1024',composition:'Create a square profile picture: centered face and upper shoulders, face prominent, full hair visible, generous padding all around for a circular profile crop. No full body.'},
 headshot:{label:'Headshot',width:1024,height:1536,apiSize:'1024x1536',composition:'Create a vertical professional headshot, chest up, with space above the head and shoulders. No full body.'}
};
function getFormat(id='headshot'){if(!Object.hasOwn(FORMATS,id))throw Error('Choose an image type.');return FORMATS[id];}
async function formatOutput(image,type='headshot',{original=false,role='executive'}={}){
 const sharp=require('sharp'),f=getFormat(type);
 if(original){
  // Preserve the entire real camera frame; never crop a fallback face.
  const bg={entrepreneur:'#5c463b',tech:'#17293d',vc:'#343d45',law:'#353038',bluecollar:'#514637',executive:'#303b49',community:'#385046'}[role]||'#303b49';
  const photo=await sharp(image).rotate().resize({width:type==='banner'?550:f.width,height:f.height,fit:'inside'}).jpeg({quality:95}).toBuffer();
  const m=await sharp(photo).metadata();
  return sharp({create:{width:f.width,height:f.height,channels:3,background:bg}}).composite([{input:photo,left:type==='banner'?f.width-m.width:Math.floor((f.width-m.width)/2),top:Math.floor((f.height-m.height)/2)}]).jpeg({quality:95}).toBuffer();
 }
 return sharp(image).rotate().resize(f.width,f.height,{fit:'cover',position:'centre'}).jpeg({quality:95}).toBuffer();
}

function promptFor(role,type='headshot'){
 const format=getFormat(type);
 if(!ROLES[role])throw Error('Choose a headshot category.');
 return 'Edit the supplied camera photograph conservatively into a professional image of exactly the ONE person in the source. The source photograph is the sole identity reference. Keep the exact facial geometry, eye shape, nose, mouth, jaw, skin tone, age, hairline, hairstyle, hair texture, facial hair, glasses and distinguishing features. Keep their real expression and clothing. Do NOT invent another face, beautify, smooth away skin texture, slim, age, lighten skin, change ethnicity, add hair or remove accessories. Keep face pixels and facial detail as close to the source as possible. Only improve background and subtle photographic lighting. No full body, no props, no text, no logos. Category is a guest-selected visual preference, not a claim about occupation. '+ROLES[role].scene+' '+format.composition;
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
async function checkSource(image){
 const r=await visionJson('Check this camera photo for a professional solo headshot. Return usable true only if exactly one real person has a clear, large, unobstructed face with adequate light. Reject business cards, printed portraits, multiple people, tiny/blurry/cut-off faces. Do not identify the person. Give a short neutral capture instruction if unusable.',
 [asImage(image)],{schema:{type:'object',properties:{usable:{type:'boolean'},reason:{type:'string'}},required:['usable','reason'],additionalProperties:false}});
 return r;
}
async function checkLikeness(source,result,type='headshot'){
 const format=getFormat(type);
 const r=await visionJson('Compare camera source (first) and edited headshot (second). Do not identify or name anyone. Conservatively check that exactly one person remains and facial geometry, skin tone, hairline, hairstyle, facial hair, glasses and approximate age are preserved, with a fully visible face and hair, without crop damage. Return matches false for visible identity drift, uncertainty, an extra person or distorted features. This is a visual quality check, not identity authentication. Required composition: '+(type==='banner'?'Wide 4:1 banner with complete head and shoulders on the right and quiet background on the left.':type==='profile'?'Centered square portrait with the full face and hair safely inside a circular crop.':'Vertical head-and-shoulders portrait.'),
 [asImage(source),asImage(result)],{schema:{type:'object',properties:{matches:{type:'boolean'},reason:{type:'string'}},required:['matches','reason'],additionalProperties:false}});
 return r.matches===true;
}
async function editHeadshot(source,role,type='headshot'){
 const format=getFormat(type);
 const form=new FormData();form.append('model',process.env.OPENAI_IMAGE_MODEL||'gpt-image-1');form.append('image',new Blob([source],{type:'image/jpeg'}),'source.jpg');
 form.append('prompt',promptFor(role,type));form.append('input_fidelity','high');form.append('quality','high');form.append('size',format.apiSize);form.append('n','1');
 const signal=AbortSignal.timeout(110000);
 const r=await openaiRequest('https://api.openai.com/v1/images/edits',{method:'POST',body:form,signal});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(Error('Headshot editing is unavailable.'),{code:safeCode(d.error?.code,r.status)});}
 const item=(await r.json()).data?.[0];
 if(item?.b64_json)return Buffer.from(item.b64_json,'base64');
 throw Error('No headshot returned.');
}
module.exports={FORMATS,getFormat,formatOutput,ROLES,promptFor,visionJson,checkSource,checkLikeness,editHeadshot};
