const cards=[['gavel','Gavel'],['scales','Scales of justice'],['books','Law books'],['court','Courthouse'],['briefcase','Briefcase'],['pen','Fountain pen']];
export function mountLegalMemory(root){
 let first=null,locked=false,matched=0,moves=0,timer=null,alive=true;
 const grid=root.querySelector('[data-memory-grid]'),status=root.querySelector('[data-memory-status]'),again=root.querySelector('[data-memory-reset]');
 function sync(){root.dataset.matches=matched;root.dataset.moves=moves;root.dataset.locked=String(locked);status.textContent=matched===6?'Case closed. All six pairs found!':matched+' / 6 pairs · '+moves+' turns';}
 function reset(){
  clearTimeout(timer);first=null;locked=false;matched=0;moves=0;grid.replaceChildren();
  const deck=cards.flatMap(c=>[c,c]);for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  deck.forEach(([id,label],index)=>{
   const b=document.createElement('button');b.type='button';b.className='memory-card';b.dataset.card=id;b.dataset.revealed='false';b.setAttribute('aria-label','Face-down card '+(index+1));b.setAttribute('aria-pressed','false');
   const turn=document.createElement('span');turn.className='memory-turn';
   const back=document.createElement('span');back.className='memory-back';back.setAttribute('aria-hidden','true');back.innerHTML='<img src="/assets/logos/rpb.png" alt=""><span>LEGACY MATCH</span>';
   const face=document.createElement('span');face.className='memory-front';face.setAttribute('aria-hidden','true');
   const img=document.createElement('img');img.src='/assets/legal-cards/'+id+'.png';img.alt='';img.draggable=false;
   const name=document.createElement('span');name.textContent=label;face.append(img,name);turn.append(back,face);b.append(turn);
   const reveal=on=>{b.dataset.revealed=String(on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?label:'Face-down card '+(index+1));};
   b.onclick=()=>{
    if(!alive||locked||b.dataset.matched==='true'||b===first?.button)return;
    reveal(true);
    if(!first){first={button:b,id,hide:()=>reveal(false)};return;}
    moves++;const previous=first;first=null;
    if(previous.id===id){matched++;for(const el of [previous.button,b]){el.dataset.matched='true';el.disabled=true;}sync();}
    else{locked=true;sync();timer=setTimeout(()=>{if(!alive)return;previous.hide();reveal(false);locked=false;sync();},1000);}
   };
   grid.append(b);
  });sync();
 }
 root.dataset.running='true';again.onclick=reset;reset();
 return ()=>{alive=false;clearTimeout(timer);again.onclick=null;grid.querySelectorAll('button').forEach(b=>b.onclick=null);root.dataset.running='false';};
}
