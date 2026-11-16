/* idle.js — keluar otomatis kalau tidak dipakai 30 menit. Dipakai halaman admin dan halaman SPL. */
(window.APPV=window.APPV||{}).idle='1.0';
window.Idle=(function(){
  const LIMIT=30*60000,WARN=60000,AK='absensi-act',MK='absensi-pesan';
  let fn=null,last=Date.now(),timer=null,box=null,going=false;
  const now=()=>Date.now();
  function stamp(){last=now();try{sessionStorage.setItem(AK,String(last))}catch(e){}}
  function hide(){if(box){box.remove();box=null}}
  function show(sec){
    if(!box){box=document.createElement('div');box.id='idlebox';
      box.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9998;background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:12px;box-shadow:var(--shadow,0 8px 30px rgba(0,0,0,.2));padding:10px 14px;display:flex;gap:12px;align-items:center;font:13px var(--ui,system-ui);max-width:calc(100vw - 24px)';
      box.innerHTML='<span id="idlet"></span><button id="idleb" type="button" style="border:0;border-radius:8px;padding:8px 12px;background:var(--accent,#222);color:var(--accent-ink,#fff);font:600 13px inherit;font-family:inherit;cursor:pointer">Tetap masuk</button>';
      document.body.appendChild(box);
      document.getElementById('idleb').onclick=()=>{stamp();hide()};
    }
    document.getElementById('idlet').textContent='Akan keluar otomatis dalam '+sec+' detik karena tidak dipakai.';
  }
  async function out(){
    if(going)return;going=true;
    try{sessionStorage.setItem(MK,'Anda keluar otomatis karena tidak dipakai selama 30 menit.')}catch(e){}
    try{if(fn)await fn()}catch(e){}
    location.reload();
  }
  function tick(){
    let st=last;try{const v=+sessionStorage.getItem(AK);if(v)st=v}catch(e){}
    const idle=now()-st;
    if(idle>=LIMIT)out();
    else if(idle>=LIMIT-WARN)show(Math.max(1,Math.ceil((LIMIT-idle)/1000)));
    else hide();
  }
  function start(logoutFn){
    fn=logoutFn;
    let st=0;try{st=+sessionStorage.getItem(AK)||0}catch(e){}
    if(st&&now()-st>=LIMIT){out();return}
    stamp();
    ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(ev=>addEventListener(ev,()=>{if(!going&&now()-last>2000){stamp();hide()}},{passive:true,capture:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
    clearInterval(timer);timer=setInterval(tick,5000);
  }
  function takeMsg(){try{const m=sessionStorage.getItem(MK);sessionStorage.removeItem(MK);return m||''}catch(e){return ''}}
  return {start,takeMsg,stamp};
})();
