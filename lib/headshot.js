const {openaiRequest}=require('./openai-request');
function imageModel(){return process.env.OPENAI_PORTRAIT_MODEL||'gpt-image-2';}
function safeCode(code,status){return ['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached','billing_not_active','usage_limit_reached','model_not_found','invalid_api_key','content_policy_violation','rate_limit_exceeded'].includes(code)?code:'provider_'+status;}
const ROLES={
 entrepreneur:{label:'Entrepreneur',scene:'A soft warm studio background with a very subtle contemporary workspace impression. Approachable founder headshot.'},
 tech:{label:'Tech enthusiast',scene:'A clean deep-navy studio background with a restrained cool rim light. Modern, approachable technology-community headshot. No devices or costumes.'},
 vc:{label:'VC',scene:'A quietly refined neutral studio backdrop with soft daylight. Professional investment-community headshot. No wealth props.'},
 law:{label:'Law firm',scene:'A warm charcoal studio backdrop, subtle formal editorial lighting. Professional legal-industry headshot. No robes, gavels, scales or invented credentials.'},
 bluecollar:{label:'Blue collar',scene:'A dignified warm-neutral studio backdrop with natural daylight. Skilled-trades professional headshot. Keep the source clothing exactly as photographed. Do not add hard hats, tools, company marks, uniforms or stereotypes.'},
 executive:{label:'Executive',scene:'An elegant slate studio background and soft directional daylight. Confident leadership headshot.'},
 community:{label:'Community leader',scene:'A warm, welcoming softly blurred natural studio backdrop. Approachable community-leadership headshot.'}
};

const FORMATS={
 banner:{label:'LinkedIn banner',width:1584,height:396,apiSize:'1584x528',composition:'Create a wide professional LinkedIn cover composition. Put the complete head and shoulders ONLY in the right third of this 3:1 canvas, with generous space above the full hairstyle and around the shoulders. Keep all hair fully inside the image, away from the top edge. The final formatter extends the quiet left background to 4:1 without cropping the portrait. The left two thirds is quiet complementary background, clear of people, objects, lettering and logos. No full body.'},
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
 if(type==='banner'){
  // Retain the full generated 3:1 frame; extend only its empty left background.
  const panel=await sharp(image).rotate().resize(1188,396,{fit:'fill'}).png().toBuffer();
  const edge=await sharp(panel).extract({left:0,top:0,width:396,height:396}).flop().png().toBuffer();
  return sharp({create:{width:1584,height:396,channels:3,background:'#303b49'}}).composite([{input:edge,left:0,top:0},{input:panel,left:396,top:0}]).jpeg({quality:95}).toBuffer();
 }
 return sharp(image).rotate().resize(f.width,f.height,{fit:'cover',position:'centre'}).jpeg({quality:95}).toBuffer();
}

function promptFor(role,type='headshot'){
 const format=getFormat(type);
 if(!ROLES[role])throw Error('Choose a headshot category.');
 return 'Create a polished, premium professional studio portrait from the supplied camera photograph of the ONE dominant foreground guest. Use the largest prominent foreground guest, normally near the center, as the only portrait subject. Exclude all incidental background bystanders, faces on posters or screens and reflections. Do not combine people or borrow another face. The source photograph is the sole identity reference. Keep the exact facial geometry, eye shape, nose, mouth, jaw, skin tone, age, hairline, hairstyle, hair texture, facial hair, glasses and distinguishing features. Keep their real expression. Preserve the exact original clothing from the source photograph in every format and category. Keep the same garments, layers, colors, patterns, fabric texture, neckline, collar, sleeves, visible garment lettering or logos, jewelry and accessories. Do not replace, recolor, restyle, tailor, add or remove clothing. Do not add a blazer, suit, tie, shirt, uniform or other garment that is absent from the source. Respect visible cultural or religious attire. Do not infer gender or add credentials. If framing reveals a little more of an existing garment, continue that same garment conservatively without inventing a new outfit. Do NOT invent another face, beautify, smooth away skin texture, slim, age, lighten skin, change ethnicity, add hair or remove accessories. Keep face pixels and facial detail as close to the source as possible. Use flattering professional studio key and fill lighting, natural skin texture, crisp focus on eyes, balanced exposure, neutral color correction, a clean background and confident upright chest-up composition. Achieve the professional look through background, lighting, focus and composition only; casual clothing must remain casual and unchanged. Preserve face, hair, expression and body proportions. Do not reshape the face, whiten teeth, erase age or alter skin tone. Reserve the bottom 20 percent for the supplied branding strip: keep all facial features and hair above it. No full body, no added props, no added text or logos; retain existing visible garment markings. Category is a guest-selected visual preference, not a claim about occupation. '+ROLES[role].scene+' '+format.composition;
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
const SOURCE_MESSAGES={no_face:'Bring your face into the camera view.',multiple_people:'Two people are posing in the foreground. Take a solo photo, with other guests behind you and outside the shoulder guide.',obscured_face:'Keep your eyes, nose and mouth visible.',unreadable_face:'Hold the phone still and move toward a light.',document:'Use the photo camera for your portrait; this image appears to be a document or card.'};
async function checkSource(image){
 const r=await visionJson('Assess portrait usability only. This is an event kiosk in a crowded venue. Select the single clearly dominant foreground guest: the largest prominent face/upper body, normally near the center. Accept when that guest has discernible eyes, nose and mouth, even if smaller, distant or partially visible bystanders are in the background. Ignore faces in posters, screens, photographs, reflections or printed clothing. Return multiple_people ONLY when two or more comparably prominent people are posing together in the foreground and no single intended subject is clear. Never reject a solo foreground guest merely because background people are visible. Normal indoor light, uneven light, tilted/low-angle selfies, natural expressions, close framing, partial hair or shoulders outside the frame and non-studio backgrounds are acceptable. Do not require studio quality. Do not assess whether this is a live camera capture, whether the image is original, or who the person is. A photograph is valid regardless of its photographic style or familiarity. Return none if usable. Return no_face for no person, multiple_people only for multiple comparably prominent foreground subjects with no clear solo guest, obscured_face only when core facial features are substantially hidden, unreadable_face only for severe blur/darkness that prevents reading facial detail, document only if the image is dominated by a business-card/document layout with text rather than a prominent person.',
 [asImage(image)],{schema:{type:'object',properties:{issue:{type:'string',enum:['none',...Object.keys(SOURCE_MESSAGES)]}},required:['issue'],additionalProperties:false}});
 if(r.issue!=='none'&&!Object.hasOwn(SOURCE_MESSAGES,r.issue))throw Error('Invalid source check.');
 return {usable:r.issue==='none',issue:r.issue,reason:SOURCE_MESSAGES[r.issue]||''};
}
async function checkLikeness(source,result,type='headshot'){
 getFormat(type);
 return visionJson('Review a photo edit, without identifying or naming the person. Compare visible facial features, hair, facial hair, skin tone, accessories and clothing between the source and edited image. The outfit must remain the same: garments, layers, colors, patterns, collar/neckline and visible markings. Changed or added clothing is an appearance change; include clothing in issues. Normal lighting changes are allowed, but wardrobe replacement or restyling is not. Normal changes in background, lighting, scale and crop are expected and are NOT appearance changes. Report appearance as consistent, changed, or uncertain. Separately assess composition; never classify a layout issue as a different face. Check for a full unobstructed face, natural anatomy, one person and usable framing. Return only the enumerated issue categories, with no names or inferred identity. Desired composition: '+(type==='banner'?'A wide banner, person toward the right, room on the left.':type==='profile'?'A square profile portrait with face centered and room for a circle crop.':'A vertical head-and-shoulders portrait.'),
 [asImage(source),asImage(result)],{schema:{type:'object',properties:{appearance:{type:'string',enum:['consistent','changed','uncertain']},composition:{type:'string',enum:['pass','review']},issues:{type:'array',items:{type:'string',enum:['facial_features','hair','skin_tone','accessories','clothing','crop','anatomy','extra_person','composition','uncertain']}}},required:['appearance','composition','issues'],additionalProperties:false}});
}
async function editHeadshot(source,role,type='headshot'){
 const format=getFormat(type);
 const form=new FormData();form.append('model',imageModel());form.append('image',new Blob([source],{type:'image/jpeg'}),'source.jpg');
 form.append('prompt',promptFor(role,type));if(imageModel().startsWith('gpt-image-1'))form.append('input_fidelity','high');form.append('quality','medium');form.append('output_format','jpeg');form.append('size',format.apiSize);form.append('n','1');
 const signal=AbortSignal.timeout(160000);
 const r=await openaiRequest('https://api.openai.com/v1/images/edits',{method:'POST',body:form,signal});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(Error('Headshot editing is unavailable.'),{code:safeCode(d.error?.code,r.status)});}
 const item=(await r.json()).data?.[0];
 if(item?.b64_json)return Buffer.from(item.b64_json,'base64');
 throw Error('No headshot returned.');
}
module.exports={imageModel,FORMATS,getFormat,formatOutput,ROLES,promptFor,visionJson,checkSource,checkLikeness,editHeadshot};
