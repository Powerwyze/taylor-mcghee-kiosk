const {reply,sameOrigin,jsonBody}=require('../lib/http');
const {openaiRequest}=require('../lib/openai-request');
const {liveSessionConfig}=require('../lib/legacy-host');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return reply(res,405,{error:'POST required'});
 if(!sameOrigin(req))return reply(res,403,{error:'Please use this kiosk.'});
 try{
  const b=await jsonBody(req);
  if(typeof b.sdp!=='string'||b.sdp.length>65000||!b.sdp.startsWith('v=0')||!b.sdp.includes('m=audio'))return reply(res,400,{error:'A microphone connection is required.'});
  const r=await openaiRequest('https://api.openai.com/v1/live/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:liveSessionConfig(),transport:{type:'webrtc',sdp:b.sdp}}),signal:AbortSignal.timeout(25000)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.transport?.sdp||!d.session?.id)return reply(res,503,{error:'Voice is unavailable. Continue with the buttons, or tap Retry voice.'});
  return reply(res,201,{session:{id:d.session.id},transport:{sdp:d.transport.sdp,type:'webrtc'}});
 }catch{return reply(res,503,{error:'Voice could not connect. Your photo flow is safe—use the buttons or retry voice.'});}
};
