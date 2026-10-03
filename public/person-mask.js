import {FilesetResolver,ImageSegmenter,ObjectDetector} from './vendor/vision/vision_bundle.mjs';
let loading;
export function preloadPersonSegmenter(){
 if(!loading)loading=(async()=>{
  const files=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
  const [segmenter,detector]=await Promise.all([
   ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/person-segmenter.tflite',delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false}),
   ObjectDetector.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/person-detector.tflite',delegate:'CPU'},runningMode:'IMAGE',scoreThreshold:.25,categoryAllowlist:['person'],maxResults:8})
  ]);
  return {segmenter,detector};
 })().catch(error=>{loading=null;throw error});
 return loading;
}
function maskMatchesPeople(values,width,height,imageWidth,imageHeight,detections){
 const people=detections.filter(d=>d.categories?.some(c=>c.categoryName==='person'&&c.score>=.25)&&d.boundingBox?.width>0&&d.boundingBox?.height>0);
 if(!people.length)return false;
 return people.every(d=>{
  const b=d.boundingBox;let hits=0,total=0;
  for(let yy=1;yy<=9;yy++)for(let xx=1;xx<=9;xx++){
   const px=Math.max(0,Math.min(width-1,Math.floor(((b.originX+b.width*xx/10)/imageWidth)*width)));
   const py=Math.max(0,Math.min(height-1,Math.floor(((b.originY+b.height*yy/10)/imageHeight)*height)));
   if(values[py*width+px]===15)hits++;total++;
  }
  return hits/total>=.11;
 });
}
export async function createPersonMask(blob){
 const {segmenter,detector}=await preloadPersonSegmenter();const bitmap=await createImageBitmap(blob);let mask;
 try{
  const detections=detector.detect(bitmap).detections||[];
  segmenter.segment(bitmap,result=>{
   const person=result.categoryMask;if(!person)throw Error('Person segmentation is unavailable.');
   const values=person.getAsUint8Array(),width=person.width,height=person.height;
   if(!maskMatchesPeople(values,width,height,bitmap.width,bitmap.height,detections))throw Error('The person outline is uncertain.');
   const pixels=new Uint8ClampedArray(width*height*4);let covered=0;
   for(let i=0;i<values.length;i++){const alpha=values[i]===15?255:0;pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=255;pixels[i*4+3]=alpha;if(alpha)covered++;}
   if(covered<values.length*.005)throw Error('No clear person outline was found.');
   const low=document.createElement('canvas');low.width=width;low.height=height;low.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);
   const full=document.createElement('canvas');full.width=bitmap.width;full.height=bitmap.height;const ctx=full.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(low,0,0,full.width,full.height);mask=full;
  });
 }finally{bitmap.close();}
 if(!mask)throw Error('No clear person outline was found.');
 return new Promise((resolve,reject)=>mask.toBlob(result=>result?resolve(result):reject(Error('Could not create the person mask.')),'image/png'));
}
