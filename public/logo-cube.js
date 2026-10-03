import * as THREE from 'three';
export function mountLogoCube(root){
 const host=root.querySelector('[data-cube-view]'),status=root.querySelector('[data-cube-status]'),select=root.querySelector('select');
 const events=new AbortController();let dead=false,frame=0,turn=null,history=[],drag=null,steps=0;
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{status.textContent='3D puzzle unavailable. Your photo is still generating.';return ()=>{};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.replaceChildren(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Drag to inspect the 3D logo cube. Use the face selector and turn buttons to solve it.');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,0,8.5);
 const view=new THREE.Group(),cube=new THREE.Group();scene.add(view);view.add(cube);view.rotation.set(.42,-.55,0);
 scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,5);scene.add(light);
 const faces=[
 {id:'front',label:'Front · RPB',axis:'z',layer:1,n:[0,0,1],rot:[0,0,0],brand:'rpb',color:'#fff0d3'},
 {id:'back',label:'Back · RPB',axis:'z',layer:-1,n:[0,0,-1],rot:[0,Math.PI,0],brand:'rpb',color:'#edc689'},
 {id:'right',label:'Right · PowerWyze',axis:'x',layer:1,n:[1,0,0],rot:[0,Math.PI/2,0],brand:'powerwyze',color:'#e5f4ed'},
 {id:'left',label:'Left · PowerWyze',axis:'x',layer:-1,n:[-1,0,0],rot:[0,-Math.PI/2,0],brand:'powerwyze',color:'#ccdcee'},
 {id:'top',label:'Top · BPN',axis:'y',layer:1,n:[0,1,0],rot:[-Math.PI/2,0,0],brand:'bpn',color:'#f8e5e5'},
 {id:'bottom',label:'Bottom · BPN',axis:'y',layer:-1,n:[0,-1,0],rot:[Math.PI/2,0,0],brand:'bpn',color:'#e8def2'}];
 select.replaceChildren(...faces.map(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.label;return o;}));
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
  root.dataset.moves=String(steps);root.dataset.turning=String(!!turn);
  const solved=parts.every(p=>p.position.distanceTo(p.userData.home)<.01&&Math.abs(p.quaternion.w)>.999);
  root.dataset.solved=String(solved);status.textContent=solved?'Solved! All six logo faces are complete.':steps+' turns · Match the logo tiles on all six faces.';
  root.querySelectorAll('button').forEach(b=>b.disabled=!!turn);root.querySelector('[data-undo]').disabled=!!turn||!history.length;
 }
 function finish(){
  const t=turn;t.pivot.updateMatrixWorld(true);for(const p of t.parts){cube.attach(p);p.position.set(Math.round(p.position.x),Math.round(p.position.y),Math.round(p.position.z));}
  cube.remove(t.pivot);turn=null;sync();
 }
 function rotate(id,direction,instant=false,record=true){
  if(dead||turn)return;const f=find(id),pivot=new THREE.Group();cube.add(pivot);cube.updateMatrixWorld(true);
  const selected=parts.filter(p=>Math.round(p.position[f.axis])===f.layer);for(const p of selected)pivot.attach(p);
  const angle=-direction*f.layer*Math.PI/2;
  if(record)history.push({id,direction});steps++;
  turn={pivot,parts:selected,axis:f.axis,angle,start:performance.now()};
  if(instant){pivot.rotation[f.axis]=angle;finish();}else sync();
 }
 function shuffle(){
  if(turn)return;for(const p of parts){p.position.copy(p.userData.home);p.quaternion.identity();}
  history=[];steps=0;for(const [id,d]of [['front',1],['right',1],['top',-1],['front',-1]])rotate(id,d,true);
  steps=0;sync();
 }
 root.querySelector('[data-clockwise]').addEventListener('click',()=>rotate(select.value,1),{signal:events.signal});
 root.querySelector('[data-counter]').addEventListener('click',()=>rotate(select.value,-1),{signal:events.signal});
 root.querySelector('[data-undo]').addEventListener('click',()=>{if(turn||!history.length)return;const m=history.pop();rotate(m.id,-m.direction,false,false);},{signal:events.signal});
 root.querySelector('[data-shuffle]').addEventListener('click',shuffle,{signal:events.signal});
 host.addEventListener('pointerdown',event=>{drag={id:event.pointerId,x:event.clientX,y:event.clientY};host.setPointerCapture(event.pointerId);},{signal:events.signal});
 host.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;view.rotation.y+=(event.clientX-drag.x)*.009;view.rotation.x+=(event.clientY-drag.y)*.009;drag.x=event.clientX;drag.y=event.clientY;},{signal:events.signal});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(name,()=>drag=null,{signal:events.signal});
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(host);
 function loop(now){if(dead)return;if(turn){const t=Math.min(1,(now-turn.start)/200);turn.pivot.rotation[turn.axis]=turn.angle*(t*t*(3-2*t));if(t===1)finish();}renderer.render(scene,camera);frame=requestAnimationFrame(loop);}
 shuffle();frame=requestAnimationFrame(loop);
 return ()=>{dead=true;root.dataset.running='false';cancelAnimationFrame(frame);resize.disconnect();events.abort();resources.forEach(r=>r.dispose());renderer.dispose();renderer.forceContextLoss();host.replaceChildren();};
}
