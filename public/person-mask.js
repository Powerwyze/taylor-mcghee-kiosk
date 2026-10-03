import {FilesetResolver,ImageSegmenter} from './vendor/vision/vision_bundle.mjs';
let loading;
export function preloadPersonSegmenter(){
 if(!loading)loading=(async()=>{
  const files=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
  return ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/person-segmenter.tflite',delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false});
 })().catch(error=>{loading=null;throw error});
 return loading;
}
export async function createPersonMask(blob){
 const segmenter=await preloadPersonSegmenter();const bitmap=await createImageBitmap(blob);let mask;
 try{segmenter.segment(bitmap,result=>{
  const person=result.categoryMask;if(!person)throw Error('Person segmentation is unavailable.');
  const values=person.getAsUint8Array(),width=person.width,height=person.height;
  const pixels=new Uint8ClampedArray(width*height*4);let covered=0;
  for(let i=0;i<values.length;i++){const alpha=values[i]===15?255:0;pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=255;pixels[i*4+3]=alpha;if(alpha)covered++;}
  if(covered<values.length*.005)throw Error('No clear person outline was found.');
  const low=document.createElement('canvas');low.width=width;low.height=height;low.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);
  const full=document.createElement('canvas');full.width=bitmap.width;full.height=bitmap.height;const ctx=full.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(low,0,0,full.width,full.height);mask=full;
 });}finally{bitmap.close();}
 if(!mask)throw Error('No clear person outline was found.');
 return new Promise((resolve,reject)=>mask.toBlob(result=>result?resolve(result):reject(Error('Could not create the person mask.')),'image/png'));
}
