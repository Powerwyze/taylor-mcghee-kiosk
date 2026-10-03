import {SIZE,ITEMS,LABELS,adjacent,matches,swapped,legalMove,newBoard,collapse} from './legal-match-engine.js';
export function mountLegalMatch(root){
 const grid=root.querySelector('[data-match-grid]'),scoreText=root.querySelector('[data-match-score]'),status=root.querySelector('[data-match-status]'),hint=root.querySelector('[data-match-hint]'),restart=root.querySelector('[data-match-reset]');
 let board=newBoard(),selected=null,score=0,moves=0,busy=false,alive=true,drag=null,suppressClick=false;
 const waits=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pause=ms=>new Promise(resolve=>{if(!alive)return resolve(false);const t=setTimeout(()=>{waits.delete(t);resolve(alive);},reduced?0:ms);waits.set(t,resolve);});
 function sync(){root.dataset.busy=String(busy);root.dataset.score=score;root.dataset.moves=moves;scoreText.textContent=score.toLocaleString();hint.disabled=restart.disabled=busy;}
 function render(drops=[]){
  grid.replaceChildren();
  board.forEach((kind,i)=>{
   const b=document.createElement('button');b.type='button';b.className='legal-gem';b.dataset.index=i;b.dataset.kind=kind;b.style.setProperty('--kind',kind);b.setAttribute('aria-label',LABELS[kind]+', row '+(Math.floor(i/SIZE)+1)+', column '+(i%SIZE+1));b.setAttribute('aria-pressed',String(selected===i));if(selected===i)b.classList.add('selected');
   const img=document.createElement('img');img.src='/assets/legal-match/'+ITEMS[kind]+'.png';img.alt='';img.draggable=false;b.append(img);
   if(drops[i]&&!reduced){b.classList.add('falling');b.style.setProperty('--drop',drops[i]);}
   grid.append(b);
  });sync();
 }
 function select(i){if(!alive||busy)return;grid.querySelectorAll('.hinted').forEach(b=>b.classList.remove('hinted'));if(selected===null){selected=i;render();}else if(selected===i){selected=null;render();}else if(adjacent(selected,i)){swap(selected,i);}else{selected=i;render();}}
 async function swap(a,b){
  if(!alive||busy||!adjacent(a,b))return;
  busy=true;selected=null;sync();
  const ca=grid.children[a],cb=grid.children[b],dx=(b%SIZE-a%SIZE)*100,dy=(Math.floor(b/SIZE)-Math.floor(a/SIZE))*100;
  ca.classList.remove('selected');ca.style.transform='translate('+dx+'%, '+dy+'%)';cb.style.transform='translate('+(-dx)+'%, '+(-dy)+'%)';
  if(!await pause(190))return;
  const changed=swapped(board,a,b),hit=matches(changed);
  if(!hit.length){ca.style.transform='';cb.style.transform='';status.textContent='Match three to make a move.';if(!await pause(190))return;busy=false;render();return;}
  board=changed;moves++;render();let chain=0;
  while(alive){
   const hit=matches(board);if(!hit.length)break;
   chain++;score+=hit.length*10*chain;status.textContent=chain>1?'Cascade ×'+chain+' · +'+hit.length*10*chain:'Case matched! +'+hit.length*10;sync();
   hit.forEach(i=>grid.children[i].classList.add('matched'));
   if(!await pause(260))return;
   const next=collapse(board,hit);board=next.board;render(next.drops);
   if(!await pause(350))return;
   if(chain>=20){board=newBoard();status.textContent='Brilliant run! Fresh board.';break;}
  }
  if(!alive)return;
  if(!legalMove(board)){board=newBoard();status.textContent='Fresh board—keep matching!';}
  busy=false;render();
 }
 grid.onclick=e=>{if(suppressClick){suppressClick=false;return;}const b=e.target.closest('[data-index]');if(b&&grid.contains(b))select(Number(b.dataset.index));};
 grid.onpointerdown=e=>{if(busy||!e.isPrimary||e.button!==0)return;const b=e.target.closest('[data-index]');if(!b)return;suppressClick=false;drag={i:Number(b.dataset.index),x:e.clientX,y:e.clientY,id:e.pointerId};grid.setPointerCapture(e.pointerId);};
 grid.onpointerup=e=>{
  if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>=18){suppressClick=true;const j=d.i+(Math.abs(dx)>Math.abs(dy)?Math.sign(dx):Math.sign(dy)*SIZE);if(j>=0&&j<SIZE*SIZE&&adjacent(d.i,j))swap(d.i,j);}
  else{ // Pointer capture retargets clicks to the grid, so activate the original tile here.
   suppressClick=true;select(d.i);
  }
 };
 grid.onpointercancel=()=>{drag=null;suppressClick=false;};
 hint.onclick=()=>{if(busy)return;const pair=legalMove(board);if(pair){grid.querySelectorAll('.hinted').forEach(b=>b.classList.remove('hinted'));pair.forEach(i=>grid.children[i].classList.add('hinted'));status.textContent='Swap the glowing pair.';}};
 restart.onclick=()=>{if(busy)return;board=newBoard();selected=null;score=moves=0;status.textContent='Swipe neighbors. Match three.';render();};
 root.dataset.running='true';status.textContent='Swipe neighbors. Match three.';render();
 return ()=>{alive=false;for(const [t,resolve]of waits){clearTimeout(t);resolve(false);}waits.clear();grid.onclick=grid.onpointerdown=grid.onpointerup=grid.onpointercancel=null;hint.onclick=restart.onclick=null;root.dataset.running='false';};
}
