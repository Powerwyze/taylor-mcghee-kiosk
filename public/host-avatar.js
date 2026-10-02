import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function mountAvatar(face,canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,30);camera.position.set(0,0,6.8);
 scene.add(new THREE.HemisphereLight(0xffefdf,0x331626,2.3));
 for(const [pos,power] of [[[-3,4,5],3],[[3,1,4],1.8]]){const l=new THREE.DirectionalLight(0xffffff,power);l.position.set(...pos);scene.add(l);}
 const model=(await new GLTFLoader().loadAsync('/assets/blueprint.glb')).scene;scene.add(model);const mouths=[];model.traverse(o=>{if(o.morphTargetDictionary)mouths.push(o);});
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const resize=()=>{const r=face.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.render(scene,camera);};
 new ResizeObserver(resize).observe(face);resize();face.dataset.avatar='ready';let last=0;
 return {update({time,level}){if(document.hidden||time-last<33)return;last=time;model.rotation.y=reduced.matches?0:-.15+Math.sin(time/3400)*.07;model.rotation.z=reduced.matches?0:Math.sin(time/4100)*.012;model.position.y=reduced.matches?0:Math.sin(time/2500)*.025;
 for(const o of mouths){const d=o.morphTargetDictionary;o.morphTargetInfluences[d.jawOpen]=reduced.matches?0:Math.min(1,level*1.2);o.morphTargetInfluences[d.mouthRound]=reduced.matches?0:level*.35;}renderer.render(scene,camera);}};
}
