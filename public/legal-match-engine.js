export const SIZE=6;
export const ITEMS=['gavel','scales','books','court','briefcase','pen'];
export const LABELS=['Gavel','Scales of justice','Law books','Courthouse','Briefcase','Fountain pen'];
export function adjacent(a,b){return a!==b&&Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))+Math.abs(a%SIZE-b%SIZE)===1;}
export function matches(board){
 const found=new Set();
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
  const i=r*SIZE+c,v=board[i];if(v==null)continue;
  if(c<=SIZE-3&&v===board[i+1]&&v===board[i+2]){let k=c;while(k<SIZE&&board[r*SIZE+k]===v)found.add(r*SIZE+k++);}
  if(r<=SIZE-3&&v===board[i+SIZE]&&v===board[i+SIZE*2]){let k=r;while(k<SIZE&&board[k*SIZE+c]===v)found.add(k++*SIZE+c);}
 }return [...found];
}
export function swapped(board,a,b){const copy=[...board];[copy[a],copy[b]]=[copy[b],copy[a]];return copy;}
export function legalMove(board){
 for(let i=0;i<board.length;i++)for(const j of [i+1,i+SIZE])if(j<board.length&&adjacent(i,j)&&matches(swapped(board,i,j)).length)return [i,j];
 return null;
}
export function newBoard(random=Math.random){
 for(let attempt=0;attempt<200;attempt++){
  const b=[];for(let i=0;i<SIZE*SIZE;i++){const choices=ITEMS.map((_,j)=>j).filter(v=>!(i%SIZE>=2&&b[i-1]===v&&b[i-2]===v)&&!(i>=SIZE*2&&b[i-SIZE]===v&&b[i-SIZE*2]===v));b.push(choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]);}
  if(legalMove(b))return b;
 }throw Error('Could not create a playable board');
}
export function collapse(board,removed,random=Math.random){
 const gone=new Set(removed),next=Array(SIZE*SIZE),drops=Array(SIZE*SIZE).fill(0);
 for(let c=0;c<SIZE;c++){
  let target=SIZE-1;
  for(let r=SIZE-1;r>=0;r--)if(!gone.has(r*SIZE+c)){next[target*SIZE+c]=board[r*SIZE+c];drops[target*SIZE+c]=target-r;target--;}
  const missing=target+1;
  for(let r=target;r>=0;r--){next[r*SIZE+c]=Math.min(ITEMS.length-1,Math.floor(random()*ITEMS.length));drops[r*SIZE+c]=missing;}
 }return {board:next,drops};
}
