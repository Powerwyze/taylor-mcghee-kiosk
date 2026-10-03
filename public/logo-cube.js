import * as THREE from 'three';
export function mountLogoCube(root){
 const host=root.querySelector('[data-cube-view]'),status=root.querySelector('[data-cube-status]');
 const events=new AbortController();let dead=false,frame=0,turn=null,viewTurn=null,history=[],drag=null,steps=0;
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{status.textContent='3D puzzle unavailable. Your photo is still generating.';return ()=>{};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.replaceChildren(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Swipe a row left or right, or a column up or down, to turn it. Use the four surrounding arrows to change the facing side.');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,0,8.5);
 const view=new THREE.Group(),cube=new THREE.Group();scene.add(view);view.add(cube);view.rotation.set(0,0,0);
 scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,5);scene.add(light);
 const faces=[
 {id:'front',label:'Front · RPB',axis:'z',layer:1,n:[0,0,1],rot:[0,0,0],brand:'rpb',color:'#fff0d3'},
 {id:'back',label:'Back · RPB',axis:'z',layer:-1,n:[0,0,-1],rot:[0,Math.PI,0],brand:'rpb',color:'#edc689'},
 {id:'right',label:'Right · PowerWyze',axis:'x',layer:1,n:[1,0,0],rot:[0,Math.PI/2,0],brand:'powerwyze',color:'#e5f4ed'},
 {id:'left',label:'Left · PowerWyze',axis:'x',layer:-1,n:[-1,0,0],rot:[0,-Math.PI/2,0],brand:'powerwyze',color:'#ccdcee'},
 {id:'top',label:'Top · BPN',axis:'y',layer:1,n:[0,1,0],rot:[-Math.PI/2,0,0],brand:'bpn',color:'#f8e5e5'},
 {id:'bottom',label:'Bottom · BPN',axis:'y',layer:-1,n:[0,-1,0],rot:[Math.PI/2,0,0],brand:'bpn',color:'#e8def2'}];
 const resources=[],parts=[],boards={};
 for(const f of faces){const c=document.createElement('canvas');c.width=c.height=600;const x=c.getContext('2d');x.fillStyle=f.color;x.fillRect(0,0,600,600);boards[f.id]=c;}
 function tile(f,x,y,z){
  let col,row;if(f.id==='front'){col=x+1;row=1-y;}if(f.id==='back'){col=1-x;row=1-y;}
  if(f.id==='right'){col=1-z;row=1-y;}if(f.id==='left'){col=z+1;row=1-y;}
  if(f.id==='top'){col=x+1;row=z+1;}if(f.id==='bottom'){col=x+1;row=1-z;}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=200;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture}),geometry=new THREE.PlaneGeometry(.92,.92);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...f.n).multiplyScalar(.486);mesh.rotation.set(...f.rot);
  const refresh=()=>{canvas.getContext('2d').drawImage(boards[f.id],col*200,row*200,200,200,0,0,200,200);texture.needsUpdate=true;};
  resources.push(texture,material,geometry);refresh();return {mesh,refresh,face:f.id};
 }
 const tiles=[];
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
  if(x===0&&y===0&&z===0)continue;
  const part=new THREE.Group();part.position.set(x,y,z);part.userData.home=new THREE.Vector3(x,y,z);
  const geo=new THREE.BoxGeometry(.96,.96,.96),mat=new THREE.MeshStandardMaterial({color:0x19141d,roughness:.5});
  resources.push(geo,mat);part.add(new THREE.Mesh(geo,mat));
  for(const f of faces)if(part.position[f.axis]===f.layer){const t=tile(f,x,y,z);part.add(t.mesh);tiles.push(t);}
  cube.add(part);parts.push(part);
 }
 for(const brand of ['rpb','powerwyze','bpn']){
  const image=new Image();image.onload=()=>{if(dead)return;for(const f of faces.filter(f=>f.brand===brand)){
   const ctx=boards[f.id].getContext('2d'),scale=Math.min(520/image.width,400/image.height),w=image.width*scale,h=image.height*scale;
   ctx.drawImage(image,(600-w)/2,(600-h)/2,w,h);
  }tiles.filter(t=>faces.find(f=>f.id===t.face).brand===brand).forEach(t=>t.refresh());};image.src='/assets/logos/'+brand+'.png';
 }
 const find=id=>faces.find(f=>f.id===id);
 function sync(){
  root.dataset.moves=String(steps);root.dataset.turning=String(!!turn||!!viewTurn);root.dataset.orientation=view.quaternion.toArray().map(n=>n.toFixed(3)).join(',');
  const solved=parts.every(p=>p.position.distanceTo(p.userData.home)<.01&&Math.abs(p.quaternion.w)>.999);
  root.dataset.solved=String(solved);status.textContent=solved?'Solved! All six logo faces are complete.':steps+' turns · Match the logo tiles on all six faces.';
  root.querySelectorAll('button').forEach(b=>b.disabled=!!turn||!!viewTurn);root.querySelector('[data-undo]').disabled=!!turn||!!viewTurn||!history.length;
 }
 function finish(){
  const t=turn;t.pivot.updateMatrixWorld(true);for(const p of t.parts){cube.attach(p);p.position.set(Math.round(p.position.x),Math.round(p.position.y),Math.round(p.position.z));}
  cube.remove(t.pivot);turn=null;sync();
 }
 function rotateLayer(axis,layer,direction,instant=false,record=true){
  if(dead||turn||viewTurn)return;const pivot=new THREE.Group();cube.add(pivot);cube.updateMatrixWorld(true);
  const selected=parts.filter(p=>Math.round(p.position[axis])===layer);for(const p of selected)pivot.attach(p);
  const angle=direction*Math.PI/2;
  if(record)history.push({axis,layer,direction});steps++;
  root.dataset.lastMove=axis+':'+layer+':'+direction;
  turn={pivot,parts:selected,axis,angle,start:performance.now()};
  if(instant){pivot.rotation[axis]=angle;finish();}else sync();
 }
 function rotate(id,direction,instant=false){const f=find(id);rotateLayer(f.axis,f.layer,-direction*f.layer,instant);}
 function shuffle(){
  if(turn||viewTurn)return;for(const p of parts){p.position.copy(p.userData.home);p.quaternion.identity();}
  history=[];steps=0;for(const [id,d]of [['front',1],['right',1],['top',-1],['front',-1]])rotate(id,d,true);
  steps=0;sync();
 }
 root.querySelector('[data-undo]').addEventListener('click',()=>{if(turn||viewTurn||!history.length)return;const m=history.pop();rotateLayer(m.axis,m.layer,-m.direction,false,false);},{signal:events.signal});
 root.querySelector('[data-shuffle]').addEventListener('click',shuffle,{signal:events.signal});
 for(const button of root.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
  if(turn||viewTurn||dead)return;drag=null;const d=button.dataset.view;
  const axis=new THREE.Vector3(...(d==='left'||d==='right'?[0,1,0]:[1,0,0]));
  const angle=(d==='left'||d==='down'?1:-1)*Math.PI/2;
  const target=new THREE.Quaternion().setFromAxisAngle(axis,angle).multiply(view.quaternion);
  viewTurn={from:view.quaternion.clone(),to:target,start:performance.now()};sync();
 },{signal:events.signal});
 const ray=new THREE.Raycaster();
 function pick(event){
  const box=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1),camera);
  scene.updateMatrixWorld(true);const hit=ray.intersectObjects(parts,true)[0];if(!hit)return null;
  let part=hit.object;while(part.parent!==cube&&part.parent)part=part.parent;if(!parts.includes(part))return null;
  const inverse=view.quaternion.clone().invert();
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).applyQuaternion(inverse);
  return {part,normal,inverse};
 }
 function swipe(event){
  if(!drag||event.pointerId!==drag.id||turn||viewTurn)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;
  const direction=Math.abs(dx)>Math.abs(dy)?new THREE.Vector3(Math.sign(dx),0,0):new THREE.Vector3(0,-Math.sign(dy),0);
  direction.applyQuaternion(drag.inverse);
  const axisVector=new THREE.Vector3().crossVectors(drag.normal,direction);
  const axis=['x','y','z'].sort((a,b)=>Math.abs(axisVector[b])-Math.abs(axisVector[a]))[0];
  const layer=Math.round(drag.part.position[axis]),sign=Math.sign(axisVector[axis]);drag=null;
  if(sign)rotateLayer(axis,layer,sign);
 }
 host.addEventListener('pointerdown',event=>{
  if(turn||viewTurn||!event.isPrimary||event.button!==0)return;const hit=pick(event);if(!hit)return;
  event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,...hit};host.setPointerCapture(event.pointerId);
 },{signal:events.signal});
 host.addEventListener('pointermove',swipe,{signal:events.signal});
 host.addEventListener('pointerup',event=>{swipe(event);drag=null;},{signal:events.signal});
 for(const name of ['pointercancel','lostpointercapture'])host.addEventListener(name,()=>drag=null,{signal:events.signal});
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(host);
 function loop(now){if(dead)return;if(viewTurn){const t=Math.min(1,(now-viewTurn.start)/220);view.quaternion.slerpQuaternions(viewTurn.from,viewTurn.to,t*t*(3-2*t));if(t===1){viewTurn=null;sync();}}if(turn){const t=Math.min(1,(now-turn.start)/200);turn.pivot.rotation[turn.axis]=turn.angle*(t*t*(3-2*t));if(t===1)finish();}renderer.render(scene,camera);frame=requestAnimationFrame(loop);}
 shuffle();frame=requestAnimationFrame(loop);
 return ()=>{dead=true;root.dataset.running='false';cancelAnimationFrame(frame);resize.disconnect();events.abort();resources.forEach(r=>r.dispose());renderer.dispose();renderer.forceContextLoss();host.replaceChildren();};
}
