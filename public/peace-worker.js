let detector;
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
  const {GestureRecognizer,FilesetResolver}=await import('/vendor/vision/vision_bundle.mjs');
  const files=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
  detector=await GestureRecognizer.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/gesture-recognizer.task',delegate:'CPU'},runningMode:'IMAGE',numHands:4,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6});
  self.postMessage({type:'ready'});
 }else if(data.type==='frame'){
  try{const result=detector.recognize(data.bitmap);self.postMessage({type:'gesture',peace:result.gestures.some(hand=>hand.some(g=>g.categoryName==='Victory'&&g.score>=.75))});}
  finally{data.bitmap.close();}
 }
}catch{self.postMessage({type:'error'});}};
