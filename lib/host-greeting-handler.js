const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {visionJson}=require('./expanded-photo');
module.exports=async(req,res)=>{
 if(req.method!=='POST'||!sameOrigin(req))return reply(res,403,{error:'Use the kiosk.'});
 try{
  const b=await jsonBody(req);
  if(typeof b.frame!=='string'||!b.frame.startsWith('data:image/jpeg;base64,')||b.frame.length>1200000)return reply(res,400,{error:'Invalid frame'});
  const d=await visionJson('This is a regular photo booth with an existing physical backdrop. Is a real person visibly present? If yes, write a warm welcome to the LegacyCon photo booth in at most two short sentences. When a clothing item, color, pattern or accessory is clearly visible, include one specific, natural compliment about it. If clothing is not clear, use a general welcome instead. Never invent details or infer identity, age, occupation, emotion, ethnicity, gender, body type or other sensitive traits. Do not call this a headshot or mention legal services. If no person is present, return personPresent false and an empty greeting.',[b.frame],{schema:{type:'object',properties:{personPresent:{type:'boolean'},greeting:{type:'string'}},required:['personPresent','greeting'],additionalProperties:false}});
  reply(res,200,{personPresent:d.personPresent===true,greeting:d.personPresent===true?String(d.greeting||'Welcome to the LegacyCon photo booth!').slice(0,240):''});
 }catch{reply(res,503,{error:'Greeting unavailable; use the buttons.'});}
};
