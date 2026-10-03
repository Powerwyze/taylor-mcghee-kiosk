// Original Case Chase mini-game. No network, audio, storage or visitor data.
const MAP=[
'###############',
'#.............#',
'#.###.#.#.###.#',
'#.....#.#.....#',
'###.#.#.#.#.###',
'#...#.....#...#',
'#.#.###.###.#.#',
'#.#.........#.#',
'#.###.#.#.###.#',
'#.....#.#.....#',
'#.###.#.#.###.#',
'#.............#',
'###############'];
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function mountGavelMaze(root){
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),scoreEl=root.querySelector('[data-score]'),status=root.querySelector('[data-status]'),play=root.querySelector('[data-play]'),pause=root.querySelector('[data-pause]');
 const events=new AbortController();let timer=null,disposed=false,running=false,score=0,lives=3,ticks=0,player,enemies,files,dir=null,wanted=null,invulnerable=0;
 const cell=32;canvas.width=480;canvas.height=416;
 const walk=(x,y)=>MAP[y]?.[x]==='.';
 function fresh(){score=0;lives=3;ticks=0;files=new Set();MAP.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='.')files.add(x+','+y);}));positions();files.delete('1,1');update();}
 function positions(){player={x:1,y:1};enemies=[{x:13,y:11},{x:13,y:1}];dir=null;wanted=null;invulnerable=10;}
 function update(){scoreEl.textContent=score+' files · '+lives+' lives';root.dataset.score=score;root.dataset.player=player.x+','+player.y;root.dataset.running=String(running);}
 function gavel(x,y){
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#ddb578';ctx.fillRect(-3,-1,6,13);ctx.fillStyle='#8c4836';ctx.fillRect(-12,-10,24,12);ctx.fillStyle='#e9bd78';ctx.fillRect(-12,-10,4,12);ctx.fillRect(8,-10,4,12);
  ctx.fillStyle='white';ctx.beginPath();ctx.arc(-3,-5,2.4,0,7);ctx.arc(4,-5,2.4,0,7);ctx.fill();ctx.fillStyle='#261522';ctx.fillRect(-3,-5,1.5,2);ctx.fillRect(4,-5,1.5,2);ctx.restore();
 }
 function draw(){
  ctx.fillStyle='#180f1b';ctx.fillRect(0,0,480,416);
  MAP.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='#'){ctx.fillStyle='#593247';ctx.fillRect(x*cell+2,y*cell+2,28,28);ctx.strokeStyle='#997051';ctx.strokeRect(x*cell+3,y*cell+3,26,26);}}));
  for(const key of files){const [x,y]=key.split(',').map(Number);ctx.fillStyle='#f7e7c3';ctx.fillRect(x*cell+13,y*cell+11,7,10);ctx.fillStyle='#a88652';ctx.fillRect(x*cell+14,y*cell+14,4,1);}
  for(const enemy of enemies){const x=enemy.x*cell+16,y=enemy.y*cell+16;ctx.fillStyle='#db6875';ctx.beginPath();ctx.arc(x,y,10,0,7);ctx.fill();ctx.strokeStyle='#301725';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x,y);ctx.lineTo(x+5,y+2);ctx.stroke();}
  gavel(player.x*cell+16,player.y*cell+16);
 }
 function step(){
  if(!running||disposed)return;ticks++;if(invulnerable)invulnerable--;
  const move=d=>{const [dx,dy]=DIRS[d]||[0,0];return walk(player.x+dx,player.y+dy);};
  if(wanted&&move(wanted))dir=wanted;
  if(dir&&move(dir)){player.x+=DIRS[dir][0];player.y+=DIRS[dir][1];}
  if(files.delete(player.x+','+player.y))score++;
  const hit=()=>!invulnerable&&enemies.some(p=>p.x===player.x&&p.y===player.y);
  let collision=hit();
  if(ticks%3===0)for(const p of enemies){
   const options=Object.values(DIRS).map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(p=>walk(p.x,p.y));
   options.sort((a,b)=>(Math.abs(a.x-player.x)+Math.abs(a.y-player.y))-(Math.abs(b.x-player.x)+Math.abs(b.y-player.y)));
   const next=Math.random()<.7?options[0]:options[Math.floor(Math.random()*options.length)];if(next)Object.assign(p,next);
  }
  collision=collision||hit();
  if(collision){lives--;if(lives){positions();status.textContent='Deadline caught you! Keep collecting.';}else{halt();status.textContent='Case closed! '+score+' files collected. Play again while you wait.';play.hidden=false;play.textContent='Play again';}}
  if(!files.size){halt();status.textContent='All files collected! Case won.';play.hidden=false;play.textContent='Play again';}
  update();draw();
 }
 function halt(){running=false;clearInterval(timer);timer=null;pause.textContent='Resume';update();}
 function start(){if(disposed||running)return;running=true;play.hidden=true;pause.hidden=false;pause.textContent='Pause';status.textContent='Collect case files. Dodge the deadlines.';timer=setInterval(step,180);update();}
 play.addEventListener('click',()=>{fresh();draw();start();},{signal:events.signal});
 pause.addEventListener('click',()=>{if(!lives||!files.size)return;if(running)halt();else start();},{signal:events.signal});
 for(const button of root.querySelectorAll('[data-dir]'))button.addEventListener('click',()=>{if(!running)return;wanted=button.dataset.dir;},{signal:events.signal});
 const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
 document.addEventListener('keydown',event=>{if(disposed||root.closest('[hidden]')||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;const d=keys[event.key];if(d){event.preventDefault();if(running)wanted=d;}},{signal:events.signal});
 let touch=null;canvas.addEventListener('pointerdown',event=>{touch=[event.clientX,event.clientY];},{signal:events.signal});
 canvas.addEventListener('pointerup',event=>{if(!touch||!running)return;const dx=event.clientX-touch[0],dy=event.clientY-touch[1];touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))>15)wanted=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';},{signal:events.signal});
 fresh();draw();pause.hidden=true;play.hidden=false;play.textContent='Play Case Chase';status.textContent='Collect case files. Dodge the deadlines.';
 return ()=>{halt();disposed=true;events.abort();};
}
