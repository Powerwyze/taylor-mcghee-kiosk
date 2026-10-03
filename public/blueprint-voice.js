import {LiveTools} from './live-tools.js';
export class BlueprintVoice{
 constructor(options){Object.assign(this,options);this.epoch=0;this.active=false;this.ready=false;this.muted=false;this.caption='';this.audio=document.getElementById('voiceAudio');this.avatar=null;this.level=0;this.raf=0;
  import('./host-avatar.js').then(m=>m.mountAvatar(document.getElementById('face'),document.getElementById('avatar'))).then(a=>this.avatar=a).catch(()=>document.getElementById('face').dataset.avatar='fallback');
  const tick=t=>{let level=0;if(this.analyser&&!this.audio.paused){const a=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(a);level=Math.min(1,Math.sqrt(a.reduce((s,v)=>s+((v-128)/128)**2,0)/a.length)*9);}this.level=this.level*.55+level*.45;this.avatar?.update({time:t,level:this.level});this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);
 }
 async prepareAudio(){if(!this.context)this.context=new AudioContext();await this.context.resume();}
 send(e){if(this.channel?.readyState==='open'&&(this.active||e.type==='session.close'))this.channel.send(JSON.stringify(e));}
 note(content,speak=false){if(!this.ready)return;this.send({type:speak?'session.commentary.append':'session.thinking.append',event_id:crypto.randomUUID(),delegation_id:null,content});}
 quiet(on){this.muted=on;this.audio.muted=on;if(on)this.note('Local photo countdown now. Stay silent until the app leaves camera.');}
 async resumeAudio(){try{await this.prepareAudio();await this.audio.play();document.getElementById('audioResume').hidden=true;}catch{this.onAudioBlocked();}}
 stop(message='Voice paused. All touch controls still work.'){
  this.send({type:'session.close'});this.epoch++;this.active=false;this.ready=false;clearTimeout(this.timer);this.request?.abort();this.tools?.clear();this.channel?.close();this.peer?.close();this.mic?.getTracks().forEach(t=>t.stop());this.peer=null;this.channel=null;this.mic=null;this.audio.pause();this.audio.srcObject=null;this.sourceNode?.disconnect();this.sourceNode=null;this.analyser=null;this.caption='';this.onCaption('');this.onStatus(message,false);
 }
 async start(greeting=''){
  if(this.active)return;this.active=true;const epoch=++this.epoch;this.caption='';this.request=new AbortController();this.onStatus('Connecting voice… You can keep using the buttons.',false);
  this.timer=setTimeout(()=>{if(epoch===this.epoch)this.stop('Voice timed out. Your photo and details are preserved. Tap retry voice or use buttons.');},35000);
  try{
   await this.prepareAudio();const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   if(epoch!==this.epoch){mic.getTracks().forEach(t=>t.stop());return;}this.mic=mic;const peer=new RTCPeerConnection();this.peer=peer;
   mic.getTracks().forEach(t=>peer.addTrack(t,mic));peer.ontrack=e=>{if(epoch!==this.epoch)return;const stream=e.streams[0]||new MediaStream([e.track]);this.audio.srcObject=stream;this.sourceNode=this.context.createMediaStreamSource(stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=256;this.sourceNode.connect(this.analyser);this.audio.play().catch(()=>this.onAudioBlocked());};
   const channel=peer.createDataChannel('oai-events');this.channel=channel;
   this.tools=new LiveTools({send:e=>{if(epoch===this.epoch)this.send(e);},execute:(n,a)=>epoch===this.epoch?this.execute(n,a):{error:'Expired session'}});
   channel.onmessage=({data})=>{if(epoch!==this.epoch)return;let e;try{e=JSON.parse(data);}catch{return;}
    if(e.type==='session.started'){clearTimeout(this.timer);this.ready=true;this.onStatus('Blueprint is listening. Buttons remain available.',true);
     const id=crypto.randomUUID();this.greetingId=id;const state=this.getState();const nextLine=state.screen==='home'?(greeting?'Use this one-line opening once: '+JSON.stringify(greeting):'Open with exactly: Hey, would you like a picture?'):state.screen==='camera'?"The guest already agreed by touch. Say exactly: Okay, tell me when you're ready. I'm going to do a countdown.":state.screen==='wait'?'Say only: You can play Legacy Match while your photo is prepared.':state.screen==='review'?'Say only: Check your photo, then tap Looks good for the QR.':state.screen==='result'?'Say only: Scan the QR to get your photo.':'Follow the current screen briefly.';this.send({type:'session.instructions.append',event_id:id,delegation_id:null,content:'Current booth state: '+JSON.stringify(state)+'. '+nextLine+' Then listen for the guest. Never restart their existing work.'});
    }else if(e.type==='session.instructions.appended'&&e.client_event_id===this.greetingId){this.greetingId=null;this.note('Say only the next short line for the current screen, then stop and listen.',true);}
    else if(e.type==='session.input_transcript.delta'){if(e.delta?.trim()){this.onActivity();this.caption='';this.onCaption('');}}
    else if(e.type==='session.output_transcript.delta'){if(!this.muted&&typeof e.delta==='string'){this.caption=(this.caption+e.delta).slice(-340);this.onCaption(this.caption);}}
    else if(e.type==='session.closed')this.stop('Voice ended. Continue with buttons or retry voice.');
    else if(e.type==='error')this.stop('Voice had a connection problem. Your work is preserved; continue with buttons.');
    else this.tools.receive(e).catch(()=>{});
   };
   channel.onclose=()=>{if(epoch===this.epoch)this.stop('Voice disconnected. Your photo and details are preserved.');};
   peer.onconnectionstatechange=()=>{if(epoch===this.epoch&&['failed','disconnected'].includes(peer.connectionState))this.stop('Voice disconnected. Keep going with the buttons.');};
   await peer.setLocalDescription(await peer.createOffer());
   await new Promise((resolve,reject)=>{if(peer.iceGatheringState==='complete')return resolve();const t=setTimeout(resolve,2000);peer.addEventListener('icegatheringstatechange',()=>{if(peer.iceGatheringState==='complete'){clearTimeout(t);resolve();}});this.request.signal.addEventListener('abort',()=>{clearTimeout(t);reject(Error('Cancelled'));},{once:true});});
   const r=await fetch('/api/host-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:peer.localDescription.sdp}),signal:AbortSignal.any([this.request.signal,AbortSignal.timeout(28000)])});const d=await r.json();
   if(epoch!==this.epoch)return;if(!r.ok||!d.transport?.sdp)throw Error(d.error||'Voice could not connect.');
   await peer.setRemoteDescription({type:'answer',sdp:d.transport.sdp});
  }catch(e){if(epoch===this.epoch)this.stop(e.name==='NotAllowedError'?'Microphone permission was denied. Use the buttons; your work is preserved.':e.message||'Voice is unavailable. Use the buttons.');}
 }
}
