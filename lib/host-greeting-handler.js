const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {visionJson}=require('../lib/headshot');
module.exports=async(req,res)=>{
 if(req.method!=='POST'||!sameOrigin(req))return reply(res,403,{error:'Use the kiosk.'});
 try{
  const b=await jsonBody(req);
  if(typeof b.frame!=='string'||!b.frame.startsWith('data:image/jpeg;base64,')||b.frame.length>1200000)return reply(res,400,{error:'Invalid frame'});
  const d=await visionJson('Is a real person visibly present? If so, write one warm short welcome to an AI headshot booth; optionally compliment visible clothing, never infer sensitive traits, identity, occupation, age or emotion. No invented facts. If no person return false and empty greeting.',[b.frame],{schema:{type:'object',properties:{personPresent:{type:'boolean'},greeting:{type:'string'}},required:['personPresent','greeting'],additionalProperties:false}});
  reply(res,200,d);
 }catch{reply(res,503,{error:'Greeting unavailable; use the buttons.'});}
};
