const {loadMeta}=require('../lib/storage');
const {hashToken,sameHex}=require('../lib/phone');
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
module.exports=async(req,res)=>{
 const url=new URL(req.url,'https://kiosk.local');
 const id=String(req.query?.id||url.searchParams.get('id')||'');
 const token=String(req.query?.token||url.searchParams.get('token')||'');
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
 try{
  const meta=token?await loadMeta(id):null;
  if(!meta?.approvedAt||!meta.viewHash||!sameHex(meta.viewHash,hashToken(token)))throw Error('invalid');
  const image='/api/image?id='+encodeURIComponent(id)+'&token='+encodeURIComponent(token);
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#4b111c"><title>Your LegacyCon photo</title><style>body{margin:0;background:#4b111c;color:#f8ebd0;font-family:system-ui,sans-serif}main{max-width:820px;margin:auto;padding:24px 16px 48px;text-align:center}h1{font:600 clamp(28px,6vw,44px) Georgia,serif}img{display:block;width:100%;height:auto;max-height:75vh;object-fit:contain;border-radius:12px}a{display:block;margin:24px auto 0;max-width:420px;padding:18px;background:#f4dfb7;color:#461821;font-weight:700;border-radius:10px;text-decoration:none}</style></head><body><main><h1>Your LegacyCon photo</h1><img src="'+escapeHtml(image)+'" alt="Your LegacyCon photo"><a href="'+escapeHtml(image)+'&download=1" download="legacycon-photo.jpg">Download photo</a></main></body></html>';
  res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
 }catch{res.statusCode=404;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('This photo link is not available.');}
};
