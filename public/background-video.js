const video=document.getElementById('backgroundVideo');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
video.defaultMuted=true;video.muted=true;video.volume=0;
function sync(){if(document.hidden||motion.matches){video.pause();return;}video.muted=true;video.volume=0;video.play().catch(()=>{});}
document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
document.addEventListener('pointerdown',()=>{if(video.paused)sync();});sync();
