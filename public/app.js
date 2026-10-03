import {mountLogoCube} from './logo-cube.js';
import {startCameraPreview,cameraErrorMessage} from './vendor/camera-preview.js';
import {runCountdown} from './vendor/host-countdown.js';
import {GuestIdle} from './vendor/host-idle.js';
import {BlueprintVoice} from './blueprint-voice.js';
import {CameraSentry} from './host-sentry.js';
const $=id=>document.getElementById(id);
let stopGame=null;
const formats=[['expanded','Start photo booth']];
const roles=[];
let version=0,controller=new AbortController(),cameraController=null,cardController=null,cameraStream=null,captureBusy=false,generating=false,claimBusy=false,attempts=0;
let screen='home',format='',role='',source=null,sourceUrl='',result=null,resultUrl='',contactConfirmed=false,contact=null,generationError='',generationErrorCode='',keyboardInput=$('phoneInput'),gameVersion=0,sentryEnabledByOperator=false;
const idle=new GuestIdle({onIdle:()=>reset(false)});
function protectedWork(){return captureBusy||generating||claimBusy||!!cardController;}
function refreshIdle(){idle.setBusy(protectedWork());}
function snapshot(){return {screen,format,expandedBackdrop:true,photoBooth:true,generating,hasSource:!!source,hasResult:!!result,contactConfirmed,delivery:'QR plus phone confirmation; no SMS',resultType:result?.path||null};}
function notify(speak=false){voice.note('Authoritative app state: '+JSON.stringify(snapshot()),speak);}
function show(name){if(name!=='wait'&&stopGame){stopGame();stopGame=null;}screen=name;$('kiosk').dataset.screen=name;document.body.classList.toggle('home-screen',name==='home');$('kiosk').dataset.format=format;document.querySelectorAll('main>.screen').forEach(el=>el.hidden=el.id!==name);
 ['step1','step2','step3'].forEach((id,i)=>$(id).classList.toggle('active',i===(['home','intro','card'].includes(name)?0:['camera'].includes(name)?1:2)));
 $('hostCaptions').textContent='';notify(name==='review');window.scrollTo({top:0,behavior:'instant'});
}
const voice=new BlueprintVoice({
 onStatus:(text,ready)=>{$('voiceStatus').textContent=ready?'Listening…':/connecting/i.test(text)?'Connecting…':/unavailable|denied|timed out|connection problem|disconnected|could not/i.test(text)?'Voice unavailable. Use buttons or retry.':'';$('voiceButton').textContent=ready?'Voice connected':'Talk to AI guide';$('voiceButton').hidden=ready;$('voiceStop').hidden=!voice.active;idle.start(ready?30000:150000);refreshIdle();},
 onCaption:text=>{$('hostCaptions').textContent=text;},
 onActivity:()=>idle.touch(),
 onAudioBlocked:()=>$('audioResume').hidden=false,
 getState:snapshot,
 execute:async(name,args)=>{
  if(name==='get_booth_status')return snapshot();
  if(name==='end_visit'&&args.confirmed===true){reset(false);return {ended:true};}
  if(name==='choose_format'&&screen==='home'&&formats.some(f=>f[0]===args.format)){chooseFormat(args.format);return snapshot();}
  if(name==='take_photo'&&screen==='camera'&&args.confirmed===true&&!captureBusy&&cameraStream){takePhoto();return {accepted:true};}
  return {error:'That action is unavailable at this step. Use the visible touch controls; phone and likeness confirmation always require a tap.'};
 }
});
const sentry=new CameraSentry({video:$('sentryVideo'),canGreet:()=>screen==='home'&&!voice.active,onVisitor:async greeting=>{if(screen==='home'){await voice.start(greeting);idle.start(30000);refreshIdle();}},onStatus:(state,message)=>{$('sentryStatus').textContent=message||(state==='watching'?'Camera welcome is watching for a visitor.':state==='off'?'Camera welcome is off.':'Preparing camera welcome…');$('sentryButton').textContent=state==='off'?'Enable camera welcome':'Stop camera welcome';}});
function stopCamera(){cameraController?.abort();cameraController=null;cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;for(const id of ['photoVideo','cardVideo'])$(id).srcObject=null;}
function reset(manual=true){cancelAvatarHold();$('avatarGestureStatus').textContent='';
 version++;controller.abort();controller=new AbortController();cardController?.abort();cardController=null;
 stopCamera();voice.stop();if(manual){sentry.disable();sentryEnabledByOperator=false;}else if(sentry.enabled)sentry.finish({immediate:true});
 generating=false;claimBusy=false;captureBusy=false;attempts=0;gameVersion++;
 for(const url of [sourceUrl,resultUrl])if(url)URL.revokeObjectURL(url);
 source=null;result=null;sourceUrl='';resultUrl='';format='';role='';contactConfirmed=false;contact=null;generationError='';generationErrorCode='';
 for(const id of ['phoneInput','nameInput','companyInput','emailInput'])$(id).value='';
 for(const id of ['reviewImage','resultImage','qrImage'])$(id).removeAttribute('src');
 $('optionalDetails').open=false;$('shortLink').textContent='';$('contactError').textContent='';$('claimError').textContent='';$('cardSummary').textContent='';$('countdown').hidden=true;
 $('approvePhoto').disabled=false;$('contactConfirm').disabled=false;$('readCard').disabled=false;
 show('home');if(!manual&&sentryEnabledByOperator&&!sentry.enabled)void sentry.enable();idle.start(150000);$('hostCaptions').textContent='';
}
async function camera(video){
 stopCamera();const epoch=version,local=new AbortController();cameraController=local;
 const stream=await startCameraPreview({video,signal:AbortSignal.any([controller.signal,local.signal])});
 if(epoch!==version||cameraController!==local){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Cancelled','AbortError');}
 cameraStream=stream;return local;
}
async function freeze(video){
 if(video.readyState<2||!video.videoWidth)throw Error('Wait for a clear camera preview.');
 const c=document.createElement('canvas');const scale=Math.min(1,1920/video.videoWidth);c.width=Math.round(video.videoWidth*scale);c.height=Math.round(video.videoHeight*scale);
 c.getContext('2d').drawImage(video,0,0,c.width,c.height);
 return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Camera frame could not be saved.')),'image/jpeg',.96));
}
function chooseFormat(id){if(screen!=='home'||!formats.some(f=>f[0]===id)||protectedWork())return;format=id;sentry.consume();if(sentry.enabled)sentry.disable();openPhoto();if(!voice.active)void voice.start();}
for(const [id,label] of formats){const b=document.createElement('button');b.className='outline format-choice';b.dataset.format=id;b.textContent=label;b.onclick=()=>chooseFormat(id);$('formatGrid').append(b);}
$('changeFormat').onclick=()=>{stopCamera();format='';show('home');};
async function openCard(){
 if(!format||!['intro','card'].includes(screen))return;sentry.consume();show('card');$('readCard').disabled=true;$('cardStatus').textContent='Starting camera…';const epoch=version;
 try{await camera($('cardVideo'));if(epoch!==version||screen!=='card')return;$('readCard').disabled=false;$('cardStatus').textContent='The card image is read once and is not saved.';}
 catch(e){if(epoch===version&&e.name!=='AbortError')$('cardStatus').textContent=cameraErrorMessage(e);}
}
function skipCard(){if(!format||!['intro','card'].includes(screen))return;cardController?.abort();cardController=null;stopCamera();sentry.consume();refreshIdle();openPhoto();}
async function readCard(){
 if(cardController||!cameraStream)return;const epoch=version;const op=new AbortController();cardController=op;$('readCard').disabled=true;$('cardStatus').textContent='Reading the printed details…';refreshIdle();
 try{
  const b=await freeze($('cardVideo'));const form=new FormData();form.append('image',b,'card.jpg');
  const r=await fetch('/api/read-card',{method:'POST',body:form,signal:AbortSignal.any([controller.signal,op.signal,AbortSignal.timeout(35000)])});const d=await r.json();
  if(!r.ok)throw Error(d.error||'The card could not be read.');
  if(epoch!==version||op.signal.aborted||screen!=='card')return;
  $('nameInput').value=d.name||'';$('companyInput').value=d.company||'';$('emailInput').value=d.email||'';$('phoneInput').value=d.phone||'';
  $('cardSummary').textContent='Card scanned.';
  stopCamera();openPhoto();
 }catch(e){if(epoch===version&&!op.signal.aborted)$('cardStatus').textContent=e.message;}
 finally{if(cardController===op){cardController=null;$('readCard').disabled=false;refreshIdle();}}
}
async function openPhoto(){
 const epoch=version;generationError='';generationErrorCode='';show('camera');$('selectedRole').textContent='YOUR BACKDROP PHOTO';$('takePhoto').disabled=true;$('cameraStatus').textContent='Starting camera…';
 try{await camera($('photoVideo'));if(epoch!==version||screen!=='camera')return;$('takePhoto').disabled=false;$('cameraStatus').textContent='5-second countdown after you tap.';notify();}
 catch(e){if(epoch===version&&e.name!=='AbortError'){$('cameraStatus').textContent=cameraErrorMessage(e);$('takePhoto').disabled=false;$('takePhoto').textContent='Retry camera';}}
}
async function takePhoto(){
 if(screen!=='camera'||captureBusy||generating)return;
 if(!cameraStream){$('takePhoto').textContent='Take photo';return openPhoto();}
 const epoch=version,cam=cameraController;captureBusy=true;$('takePhoto').disabled=true;refreshIdle();voice.quiet(true);notify();
 try{
  await runCountdown({seconds:5,signal:AbortSignal.any([controller.signal,cam.signal]),onTick:n=>{$('countdown').hidden=false;$('countdown').textContent=n;}});
  const b=await freeze($('photoVideo'));
  if(epoch!==version||cam.signal.aborted)return;
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);source=b;sourceUrl=URL.createObjectURL(b);stopCamera();
  contactConfirmed=false;result=null;contact=null;$('optionalDetails').open=['nameInput','companyInput','emailInput'].some(id=>$(id).value.trim());show('contact');$('generationStatus').textContent='Expanding your backdrop.';
  generate(); // Deliberately independent of contact entry.
 }catch(e){if(epoch===version&&!cam.signal.aborted)$('cameraStatus').textContent='Capture did not finish. Tap Take photo to try again.';}
 finally{if(epoch===version){captureBusy=false;$('countdown').hidden=true;$('takePhoto').disabled=false;voice.quiet(false);refreshIdle();}}
}
async function generate(){
 if(!source||generating||attempts>=3)return;attempts++;const epoch=version;generating=true;generationError='';generationErrorCode='';refreshIdle();notify();
 try{
  const form=new FormData();form.append('image',source,'photo-booth-source.jpg');form.append('format',format);
  const r=await fetch('/api/expanded-photo',{method:'POST',body:form,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(235000)])});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(Error(d.error||'The image did not finish.'),{code:d.code});}
  const blob=await r.blob();if(!blob.type.startsWith('image/'))throw Error('No expanded photo returned.');
  const id=r.headers.get('X-Photo-Id'),claim=r.headers.get('X-Claim-Token');
  if(!id||!claim)throw Error('The photo link was incomplete.');
  if(epoch!==version)return;const url=URL.createObjectURL(blob);const image=new Image();image.src=url;
  try{await image.decode();}catch(e){URL.revokeObjectURL(url);throw e;}
  if(epoch!==version){URL.revokeObjectURL(url);return;}
  if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=url;
  result={id,claim,path:r.headers.get('X-RPB-Path'),notice:decodeURIComponent(r.headers.get('X-Photo-Notice')||'Please check your wider photo.')};
  $('generationStatus').textContent='Wider photo ready. Confirm to continue.';
 }catch(e){if(epoch===version&&!controller.signal.aborted){generationErrorCode=e.code||'';generationError=e.message||'The image timed out. Try again.';$('generationStatus').textContent='Confirm to see photo options.';}}
 finally{if(epoch===version){generating=false;refreshIdle();if(contactConfirmed)advance();notify();}}
}
function phoneValue(s){let n=String(s).replace(/\D/g,'');if(n.length===11&&n[0]==='1')n=n.slice(1);return /^[2-9]\d{2}[2-9]\d{6}$/.test(n)?n:'';}
function advance(){
 if(!contactConfirmed)return;
 if(result){$('reviewImage').src=resultUrl;$('photoNotice').textContent=result.notice;$('regeneratePhoto').disabled=attempts>=3;show('review');gameVersion++;return;}
 if(generationError){$('errorMessage').textContent=generationError;$('retryPhoto').hidden=generationErrorCode==='RETAKE';$('retryPhoto').disabled=attempts>=3;show('errorScreen');return;}
 show('wait');buildGame();voice.note('The guest confirmed photo access details on screen. Let them know the wider backdrop photo is processing. Offer a short, optional conversation while they wait; keep the focus on the photo booth and do not pitch services.',true);
}
$('contactForm').onsubmit=e=>{
 e.preventDefault();const phone=phoneValue($('phoneInput').value),email=$('emailInput').value.trim();
 if(!phone){$('contactError').textContent='Enter a valid 10-digit US mobile number.';$('phoneInput').focus();return;}
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('contactError').textContent='Correct the email or leave it blank.';return;}
 $('contactError').textContent='';contact={phone,name:$('nameInput').value.trim(),company:$('companyInput').value.trim(),email};contactConfirmed=true;advance();
};
async function approve(){
 if(claimBusy||!contactConfirmed||!result||screen!=='review')return;const epoch=version;claimBusy=true;refreshIdle();$('approvePhoto').disabled=true;$('claimError').textContent='Preparing your QR…';
 try{
  const r=await fetch('/api/claim-photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...contact,id:result.id,claim:result.claim,confirmed:true,likenessApproved:true}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});const d=await r.json();
  if(!r.ok||!d.ok)throw Error(d.error||'Please try confirming again.');
  if(epoch!==version)return;const link=location.origin+'/p/'+result.id;
  $('resultImage').src=resultUrl;$('qrImage').src='/api/qr?text='+encodeURIComponent(link);$('shortLink').textContent=link;$('claimError').textContent='';show('result');voice.note('The QR is ready. Tell the guest to scan it and enter the same phone number to save their photo. Thank them. No SMS was sent.',true);
 }catch(e){if(epoch===version)$('claimError').textContent=e.message;}
 finally{if(epoch===version){claimBusy=false;$('approvePhoto').disabled=false;refreshIdle();}}
}
function retake(){if(protectedWork())return;result=null;contactConfirmed=false;contact=null;attempts=0;if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl='';openPhoto();}
function editContact(){if(claimBusy)return;contactConfirmed=false;show('contact');}
function buildGame(){stopGame?.();stopGame=mountLogoCube($('logoCube'));}
for(const id of ['phoneInput','nameInput','companyInput','emailInput']){$(id).onfocus=()=>keyboardInput=$(id);$(id).oninput=()=>{contactConfirmed=false;idle.touch();};}
function toggleKeyboard(){const open=$('keyboard').hidden;$('keyboard').hidden=!open;$('keyboardToggle').textContent=open?'Hide touch keyboard':'Show touch keyboard';for(const id of ['phoneInput','nameInput','companyInput','emailInput'])$(id).inputMode=open?'none':id==='phoneInput'?'tel':id==='emailInput'?'email':'text';}
let shift=false;for(const row of ['1234567890','qwertyuiop','asdfghjkl','zxcvbnm','@._-','SPACE SHIFT LEFT RIGHT DELETE']){const el=document.createElement('div');el.className='key-row';for(const key of row.includes(' ')?row.split(' '):[...row]){const b=document.createElement('button');b.type='button';b.textContent=key;b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{const t=keyboardInput;let start=t.selectionStart??t.value.length,end=t.selectionEnd??start;if(key==='SHIFT'){shift=!shift;b.setAttribute('aria-pressed',shift);return;}if(key==='LEFT'||key==='RIGHT'){const p=Math.max(0,Math.min(t.value.length,start+(key==='LEFT'?-1:1)));t.setSelectionRange(p,p);}else{if(key==='DELETE'&&start===end)start=Math.max(0,start-1);const s=key==='DELETE'?'':key==='SPACE'?' ':shift?key.toUpperCase():key;if(t.value.length-end+start+s.length<=t.maxLength)t.setRangeText(s,start,end,'end');t.dispatchEvent(new Event('input'));}t.focus({preventScroll:true});};el.append(b);}$('keyboard').append(el);}
$('keyboardToggle').onclick=toggleKeyboard;
$('scanStart').onclick=openCard;$('skipCard').onclick=skipCard;$('cardSkip').onclick=skipCard;$('readCard').onclick=readCard;
$('takePhoto').onclick=takePhoto;
$('cameraBack').onclick=()=>{stopCamera();captureBusy=false;voice.quiet(false);refreshIdle();reset(false);};
$('regeneratePhoto').onclick=()=>{if(protectedWork()||!source||attempts>=3||screen!=='review')return;result=null;generationError='';generationErrorCode='';show('wait');buildGame();generate();};
$('approvePhoto').onclick=approve;$('retakePhoto').onclick=retake;$('errorRetake').onclick=retake;
$('reviewContact').onclick=editContact;$('editContact').onclick=editContact;
$('retryPhoto').onclick=()=>{if(generating||attempts>=3||generationErrorCode==='RETAKE')return;generationError='';generationErrorCode='';show('wait');buildGame();generate();};
$('doneButton').onclick=()=>reset(false);$('resetButton').onclick=()=>reset(true);
$('voiceButton').onclick=()=>voice.start();$('voiceStop').onclick=()=>voice.stop();$('audioResume').onclick=()=>voice.resumeAudio();
let sentryToggleBusy=false;
async function toggleSentry(){
 if(sentryToggleBusy)return;
 if(sentry.enabled){sentry.disable();sentryEnabledByOperator=false;$('avatarGestureStatus').textContent='Camera welcome off.';return;}
 if(screen!=='home'){$('avatarGestureStatus').textContent='Finish this visit or start over to enable camera welcome.';return;}
 const sentryEpoch=version;sentryToggleBusy=true;$('avatarGestureStatus').textContent='Enabling camera welcome…';
 try{await voice.prepareAudio();const m=await navigator.mediaDevices.getUserMedia({audio:true});m.getTracks().forEach(t=>t.stop());if(screen!=='home'||sentryEpoch!==version)return;sentryEnabledByOperator=true;await sentry.enable();$('avatarGestureStatus').textContent='Camera welcome on.';}
 catch{sentryEnabledByOperator=false;$('avatarGestureStatus').textContent='Allow camera and microphone to enable camera welcome.';}
 finally{sentryToggleBusy=false;}
}
$('sentryButton').onclick=toggleSentry;
const avatarTarget=$('face');avatarTarget.tabIndex=0;avatarTarget.setAttribute('role','button');avatarTarget.setAttribute('aria-label','Hold for one second to toggle camera welcome, or press Enter');
let holdTimer=null,holdPoint=null;
function cancelAvatarHold(){clearTimeout(holdTimer);holdTimer=null;holdPoint=null;avatarTarget.classList.remove('sentry-hold');}
avatarTarget.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;cancelAvatarHold();holdPoint={x:event.clientX,y:event.clientY};avatarTarget.classList.add('sentry-hold');holdTimer=setTimeout(()=>{cancelAvatarHold();toggleSentry();},1000);});
avatarTarget.addEventListener('pointermove',event=>{if(holdPoint&&Math.hypot(event.clientX-holdPoint.x,event.clientY-holdPoint.y)>12)cancelAvatarHold();});
for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])avatarTarget.addEventListener(event,cancelAvatarHold);
avatarTarget.addEventListener('contextmenu',event=>event.preventDefault());
avatarTarget.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.repeat){event.preventDefault();toggleSentry();}});
document.addEventListener('visibilitychange',cancelAvatarHold);
document.addEventListener('pointerdown',()=>idle.touch());document.addEventListener('keydown',()=>idle.touch());
document.addEventListener('visibilitychange',()=>{if(document.hidden){sentry.disable();sentryEnabledByOperator=false;reset(true);idle.stop();}});
window.addEventListener('pagehide',()=>{sentry.disable();reset(true);idle.stop();});
idle.start(150000);show('home');$('hostCaptions').textContent='';
