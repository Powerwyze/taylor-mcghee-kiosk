export class PeaceCapture{
 constructor({video,canCapture,onCapture,onStatus}){Object.assign(this,{video,canCapture,onCapture,onStatus});this.epoch=0;}
 start(){this.stop();const epoch=this.epoch;this.worker=new Worker('/peace-worker.js');this.onStatus('Preparing peace-sign capture…');
  this.worker.onerror=()=>this.fail(epoch);
  this.worker.onmessage=({data})=>{if(epoch!==this.epoch)return;
   if(data.type==='error')return this.fail(epoch);
   if(data.type==='ready'){clearTimeout(this.timer);this.onStatus('Hold up ✌️ for a 10-second countdown.');this.schedule(epoch);}
   if(data.type==='gesture'){clearTimeout(this.timer);const now=performance.now();
    if(!this.canCapture()||now-this.sentAt>2000||!data.peace){this.since=0;this.samples=0;}
    else{if(!this.since)this.since=now;this.samples++;if(this.samples>=4&&now-this.since>=800){this.stop();this.onCapture();return;}}
    this.schedule(epoch);
   }
  };this.timer=setTimeout(()=>this.fail(epoch),30000);this.worker.postMessage({type:'init'});
 }
 schedule(epoch){this.timer=setTimeout(async()=>{if(epoch!==this.epoch)return;
  if(document.hidden||!this.canCapture()||this.video.readyState<2){this.since=0;this.samples=0;this.schedule(epoch);return;}
  try{const bitmap=await createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.max(1,Math.round(640*this.video.videoHeight/this.video.videoWidth))});if(epoch!==this.epoch){bitmap.close();return;}this.sentAt=performance.now();this.worker.postMessage({type:'frame',bitmap},[bitmap]);this.timer=setTimeout(()=>this.fail(epoch),8000);}catch{this.fail(epoch);}
 },220);}
 fail(epoch){if(epoch!==this.epoch)return;this.stop();this.onStatus('Peace-sign capture unavailable. Tap Take photo.');}
 stop(){this.epoch++;clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.since=0;this.samples=0;}
}
