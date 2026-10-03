import {FilesetResolver,ImageSegmenter} from './vendor/vision/vision_bundle.mjs';
let loading;
export function preloadPersonSegmenter(){
 if(!loading)loading=(async()=>{
  const files=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
  return ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/selfie-segmenter.tflite',delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true});
 })().catch(error=>{loading=null;throw error});
 return loading;
}
export async function createPersonMask(blob){
 const segmenter=await preloadPersonSegmenter();
 const bitmap=await createImageBitmap(blob);let mask;
 try{segmenter.segment(bitmap,result=>{const person=result.confidenceMasks?.[1];if(!person)throw Error('Person segmentation is unavailable.');const values=person.getAsFloat32Array();const width=person.width,height=person.height;const pixels=new Uint8ClampedArray(width*height*4);let covered=0;for(let i=0;i<values.length;i++){const p=Math.max(0,Math.min(1,(values[i]-.2)/.6));const alpha=Math.round((p*p*(3-2*p))*255);pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=255;pixels[i*4+3]=alpha;if(alpha>80)covered++;}if(covered<values.length*.005)throw Error('Move into the camera view and retake your photo.');const low=document.createElement('canvas');low.width=width;low.height=height;low.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);const full=document.createElement('canvas');full.width=bitmap.width;full.height=bitmap.height;const ctx=full.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(low,0,0,full.width,full.height);mask=full;});}
 finally{bitmap.close();}
 if(!mask)throw Error('Could not find a guest in the photo.');
 return new Promise((resolve,reject)=>mask.toBlob(result=>result?resolve(result):reject(Error('Could not create the person mask.')),'image/png'));
}
