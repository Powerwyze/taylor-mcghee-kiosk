export class PeaceCapture{
 constructor({video,canCapture,onCapture,onStatus}){Object.assign(this,{video,canCapture,onCapture,onStatus});this.session=0;this.ready=false;}
 start(){this.stop();this.active=true;
  if(this.ready){this.onStatus('Show ✌️ beside your face to start the countdown.');this.schedule();return;}
  this.onStatus('Preparing peace-sign capture…');if(this.worker)return;
  this.worker=new Worker('/peace-worker.js');this.worker.onerror=()=>this.fail();
  this.worker.onmessage=({data})=>{
   if(data.type==='error')return this.fail();
   if(data.type==='ready'){clearTimeout(this.loadTimer);this.ready=true;if(this.active){this.onStatus('Show ✌️ beside your face to start the countdown.');this.schedule();}return;}
   if(data.type!=='gesture'||!this.active||data.session!==this.session)return;
   clearTimeout(this.timer);const now=performance.now();
   if(!this.canCapture()||now-this.sentAt>1500||!data.peace){this.since=0;this.samples=0;}
   else{if(!this.since)this.since=now;this.samples++;this.onStatus('Peace sign seen — hold briefly…');if(this.samples>=2&&now-this.since>=150){this.stop();this.onCapture();return;}}
   this.schedule();
  };this.loadTimer=setTimeout(()=>this.fail(),30000);this.worker.postMessage({type:'init'});
 }
 schedule(){const session=this.session;this.timer=setTimeout(async()=>{
  if(!this.active||session!==this.session)return;
  if(document.hidden||!this.canCapture()||this.video.readyState<2){this.since=0;this.samples=0;this.schedule();return;}
  try{const bitmap=await createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.max(1,Math.round(640*this.video.videoHeight/this.video.videoWidth))});if(!this.active||session!==this.session){bitmap.close();return;}this.sentAt=performance.now();this.worker.postMessage({type:'frame',bitmap,timestamp:this.sentAt,session},[bitmap]);this.timer=setTimeout(()=>this.fail(),8000);}catch{this.fail();}
 },80);}
 fail(){this.stop();clearTimeout(this.loadTimer);this.worker?.terminate();this.worker=null;this.ready=false;this.onStatus('Peace-sign capture unavailable. Tap Take photo.');}
 stop(){this.active=false;this.session++;clearTimeout(this.timer);this.since=0;this.samples=0;}
}
