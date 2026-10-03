const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {visionJson}=require('../lib/headshot');
module.exports=async(req,res)=>{
 if(req.method!=='POST'||!sameOrigin(req))return reply(res,403,{error:'Use the kiosk.'});
 try{
  const b=await jsonBody(req);
  if(typeof b.frame!=='string'||!b.frame.startsWith('data:image/jpeg;base64,')||b.frame.length>1200000)return reply(res,400,{error:'Invalid frame'});
  const d=await visionJson('Is a person visibly present in this camera frame? If yes, write a brief friendly opening for RPB Law Firm at LegacyCon. FIRST give one natural compliment about a clearly visible garment, clothing color, pattern, or accessory, then a short welcome. Example only when visible: That blue jacket looks sharp—welcome to LegacyCon! Do not invent garments or colors. If clothing is not visible or uncertain, just say Welcome to LegacyCon—great to have you here! Never infer sensitive traits, identity, occupation, age, emotion, attractiveness, body shape or prior visits. Do not ask the photo question yet; the voice host adds that afterward. If no person return false and empty greeting.',[b.frame],{schema:{type:'object',properties:{personPresent:{type:'boolean'},greeting:{type:'string'}},required:['personPresent','greeting'],additionalProperties:false}});
  reply(res,200,d);
 }catch{reply(res,503,{error:'Greeting unavailable; use the buttons.'});}
};
