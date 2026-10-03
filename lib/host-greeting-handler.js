const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {openaiRequest}=require('./openai-request');
async function visionJson(instructions,images,{schema}){const r=await openaiRequest('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',store:false,input:[{role:'user',content:[{type:'input_text',text:instructions},...images.map(image_url=>({type:'input_image',image_url,detail:'low'}))]}],text:{format:{type:'json_schema',name:'greeting',strict:true,schema}},max_output_tokens:120}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Vision unavailable');const d=await r.json();const content=d.output_text||(d.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');return JSON.parse(content);}
module.exports=async(req,res)=>{
 if(req.method!=='POST'||!sameOrigin(req))return reply(res,403,{error:'Use the kiosk.'});
 try{
  const b=await jsonBody(req);
  if(typeof b.frame!=='string'||!b.frame.startsWith('data:image/jpeg;base64,')||b.frame.length>1200000)return reply(res,400,{error:'Invalid frame'});
  const d=await visionJson('This is a regular photo booth with an existing physical backdrop. Is a real person visibly present? If yes, write a warm welcome to the LegacyCon photo booth in at most two short sentences. When a clothing item, color, pattern or accessory is clearly visible, include one specific, natural compliment about it. If clothing is not clear, use a general welcome instead. Never invent details or infer identity, age, occupation, emotion, ethnicity, gender, body type or other sensitive traits. Do not call this a headshot or mention legal services. If no person is present, return personPresent false and an empty greeting.',[b.frame],{schema:{type:'object',properties:{personPresent:{type:'boolean'},greeting:{type:'string'}},required:['personPresent','greeting'],additionalProperties:false}});
  reply(res,200,{personPresent:d.personPresent===true,greeting:d.personPresent===true?String(d.greeting||'Welcome to the LegacyCon photo booth!').slice(0,240):''});
 }catch{reply(res,503,{error:'Greeting unavailable; use the buttons.'});}
};
