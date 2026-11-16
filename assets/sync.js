/* sync.js — data admin disimpan di server (Firebase) supaya sama di semua komputer.
   Login admin wajib. Perubahan disimpan otomatis; perubahan komputer lain masuk otomatis. */
(window.APPV=window.APPV||{}).sync='1.0';
(function(){
if(typeof boot==='undefined'||typeof S==='undefined'||!window.Cloud)return;
const CK='absensi-sync-at',MARGIN=600000;
const _boot=boot;
let SH=new Map(),lastAt=0,synced=false,dirty=false,busy=false,timer=null,failed=false,queue=[],rr=false,userName='';
const SKIP=new Set(['emps','att','spl']);

/* ---------- bentuk data ---------- */
function cj(v){
  if(Array.isArray(v))return '['+v.map(cj).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+cj(v[k])).join(',')+'}';
  return JSON.stringify(v===undefined?null:v);
}
const clean=v=>JSON.parse(JSON.stringify(v));
const blank=()=>migrate({demo:false,emps:[],att:{},spl:[],set:DEFAULT_SET(),imports:[]});
function split(st){
  const out=new Map(),put=(d,k,v)=>{let m=out.get(d);if(!m)out.set(d,m=new Map());m.set(k,{v,j:cj(v)})};
  Object.keys(st).forEach(k=>{if(!SKIP.has(k))put('main',k,st[k])});
  (st.emps||[]).forEach((e,i)=>put('emps',String(e.id),Object.assign({},e,{_o:i})));
  Object.keys(st.att||{}).forEach(k=>{const i=k.lastIndexOf('|');put('att_'+k.slice(i+1),k.slice(0,i),st.att[k])});
  (st.spl||[]).forEach(x=>put('spl_'+String(x.date||'0000-00').slice(0,7),String(x.id),Object.assign({},x,{emps:(x.emps||[]).join(',')})));
  return out;
}
const shadowOf=sp=>{const o=new Map();sp.forEach((m,id)=>{const s=new Map();m.forEach((x,k)=>s.set(k,x.j));o.set(id,s)});return o};

/* ---------- simpan ke server ---------- */
function save2(){dirty=true;clearTimeout(timer);timer=null;if(synced)timer=setTimeout(flush,700);stat('wait')}
async function flush(){
  if(!synced){dirty=true;return}
  if(busy){dirty=true;return}
  busy=true;dirty=false;clearTimeout(timer);timer=null;
  try{
    const cur=split(S),ops=[];
    cur.forEach((m,id)=>{
      const sh=SH.get(id)||new Map(),set={},del=[];
      m.forEach((x,k)=>{if(sh.get(k)!==x.j)set[k]=clean(x.v)});
      sh.forEach((j,k)=>{if(!m.has(k))del.push(k)});
      if(Object.keys(set).length||del.length)ops.push({id,set,del});
    });
    SH.forEach((sh,id)=>{if(!cur.has(id)&&sh.size)ops.push({id,set:{},del:[...sh.keys()]})});
    if(ops.length){
      const at=await Cloud.dCommit(ops);lastAt=Math.max(lastAt,at);
      ops.forEach(o=>{let sh=SH.get(o.id);if(!sh)SH.set(o.id,sh=new Map());
        Object.keys(o.set).forEach(k=>sh.set(k,cur.get(o.id).get(k).j));o.del.forEach(k=>sh.delete(k))});
    }
    cache();failed=false;stat('ok');
  }catch(e){
    failed=true;dirty=true;stat('err',e.message);
    setTimeout(()=>{if(failed&&!busy)flush()},8000);
  }
  busy=false;
  if(!failed){if(dirty)flush();else drain()}
}
function cache(){
  try{sessionStorage.setItem(KEY,JSON.stringify(S));sessionStorage.setItem(CK,JSON.stringify({at:lastAt,u:userName}))}
  catch(e){try{sessionStorage.removeItem(CK)}catch(x){}}
}

/* ---------- terima dari server ---------- */
function apply(docs){
  let ch=false;const todo=[];
  docs.forEach(d=>{
    if(d.pending)return;
    const m=(d.data&&d.data.m)||{};lastAt=Math.max(lastAt,(d.data&&d.data.at)||0);
    const sh=new Map();Object.keys(m).forEach(k=>sh.set(k,cj(m[k])));
    const old=SH.get(d.id);
    if(old&&old.size===sh.size&&[...sh].every(([k,j])=>old.get(k)===j))return;
    todo.push({id:d.id,m,sh,old});
  });
  /* hapus dulu, baru tambah, supaya SPL yang pindah bulan tidak ikut terhapus */
  todo.forEach(t=>{
    if(t.id.startsWith('spl_')&&t.old)t.old.forEach((_,k)=>{if(!(k in t.m)){const i=S.spl.findIndex(x=>x.id===k);if(i>=0)S.spl.splice(i,1)}});
    if(t.id==='main'&&t.old)t.old.forEach((_,k)=>{if(!(k in t.m))delete S[k]});
  });
  todo.forEach(t=>{
    const m=t.m;ch=true;
    if(t.id==='main')Object.keys(m).forEach(k=>{S[k]=m[k]});
    else if(t.id==='emps')S.emps=Object.keys(m).map(k=>m[k]).sort((a,b)=>(a._o||0)-(b._o||0)).map(e=>{const c=Object.assign({},e);delete c._o;return c});
    else if(t.id.startsWith('att_')){
      const D='|'+t.id.slice(4);Object.keys(S.att).forEach(k=>{if(k.endsWith(D))delete S.att[k]});
      Object.keys(m).forEach(k=>{S.att[k+D]=m[k]});
    }else if(t.id.startsWith('spl_'))Object.keys(m).forEach(k=>{
      const x=Object.assign({},m[k]);x.emps=x.emps===''||x.emps==null?[]:String(x.emps).split(',');
      const i=S.spl.findIndex(y=>y.id===k);if(i>=0)S.spl[i]=x;else S.spl.push(x)});
    SH.set(t.id,t.sh);
  });
  if(ch){S=migrate(S);cache()}
  return ch;
}
function drain(){
  if(dirty||busy||timer||!queue.length)return;
  const q=queue;queue=[];
  if(apply(q))rerender();
}
function rerender(){
  if(rr)return;rr=true;
  const go=()=>{
    const a=document.activeElement,typing=a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    const lay=document.getElementById('layer'),open=(lay&&lay.innerHTML.trim())||ui.drawer;
    if(typing||open){setTimeout(go,2500);return}
    rr=false;try{render()}catch(e){}
  };
  go();
}

/* ---------- tampilan: layar login dan status ---------- */
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DK='--sy-a:#e3e6e8;--sy-a2:#e3e6e8;--sy-ai:#14171a;--sy-bg1:#15181b;--sy-bg2:#0f1113;--sy-ink:#e8eaec;--sy-mut:#9aa1a8;--sy-card:#1a1e21;--sy-off:#262b2f;--sy-offink:#e0e3e5;--sy-bl:#1b1f22;--sy-w1:#1f2427;--sy-w2:#2c3236;--sy-ln:#2b3135;--sy-in:#121517;--sy-dot:#2b3135';
const DK2='#syncov .sy-lg{background:#fff;border-radius:16px;padding:8px;height:70px}';
function css(){
  if(document.getElementById('sy-css'))return;
  const s=document.createElement('style');s.id='sy-css';
  s.textContent=`:root{--sy-a:#2B3036;--sy-a2:#2B3036;--sy-ai:#fff;--sy-bg1:#fafafa;--sy-bg2:#f0f1f2;--sy-ink:#1D2024;--sy-mut:#6B7177;--sy-card:#fff;--sy-off:#eceef0;--sy-offink:#2B3036;--sy-bl:#e9ebed;--sy-w1:#e3e6e8;--sy-w2:#d3d7da;--sy-ln:#E4E7E9;--sy-in:#f6f7f8;--sy-dot:#d5d9dc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DK}}${DK2.replace('#syncov','html:not([data-theme="light"]) #syncov')}}
:root[data-theme="dark"]{${DK}}${DK2.replace('#syncov','html[data-theme="dark"] #syncov')}
#syncov{position:fixed;inset:0;z-index:9999;background:linear-gradient(160deg,var(--sy-bg1),var(--sy-bg2));display:flex;flex-direction:column;align-items:center;padding:clamp(36px,10vh,100px) 16px 16px;overflow:auto;font-family:var(--ui,system-ui,sans-serif);color:var(--sy-ink)}
#syncov>*{position:relative}#syncov>svg.sy-bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sy-lg{height:64px;width:auto;display:block;box-sizing:content-box}
.sy-h{margin:14px 0 4px;font-size:clamp(22px,5vw,28px);font-weight:700;letter-spacing:-.3px;text-align:center}
.sy-p{margin:0 0 22px;color:var(--sy-mut);font-size:14px;text-align:center}
.sy-m{margin:-8px 0 14px;font-size:13px;color:var(--sy-mut);text-align:center;max-width:340px}
.sy-card{background:var(--sy-card);border-radius:14px;box-shadow:0 10px 32px rgba(20,24,28,.12);padding:12px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.sy-col{flex-direction:column;gap:10px;width:min(100%,280px);padding:16px}
.sy-b{display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:9px;padding:12px 28px;font:700 14px/1 inherit;font-family:inherit;cursor:pointer;text-decoration:none;min-width:120px}
.sy-b.on{background:var(--sy-a);color:var(--sy-ai)}.sy-b.off{background:var(--sy-off);color:var(--sy-offink)}
.sy-in{width:100%;box-sizing:border-box;border:1px solid var(--sy-ln);border-radius:8px;padding:11px 12px;font:14px inherit;font-family:inherit;color:var(--sy-ink);background:var(--sy-in);outline:none}
.sy-in:focus{border-color:var(--sy-a)}
.sy-go{border:0;border-radius:8px;padding:11px;background:var(--sy-a);color:var(--sy-ai);font:700 14px inherit;font-family:inherit;cursor:pointer}.sy-go:disabled{opacity:.6}
.sy-lk{font-size:12px;color:var(--sy-mut);text-align:center;cursor:pointer;text-decoration:none;margin-top:12px;display:block}.sy-lk:hover{color:var(--sy-ink)}
.sy-card .sy-lk{margin-top:0}
.sy-er{color:#B03F2B;font-size:13px;text-align:center}.sy-er:empty{display:none}
.sy-t{font-size:14px;color:var(--sy-mut);text-align:center;line-height:1.5}`;
  document.head.appendChild(s);
}
const USR='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M17.5 14.5c2.4.2 3.8 1.8 3.8 4.5"/></svg>';
const FAC='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V9l6 4V9l6 4V5h3v15zM3 20h18"/></svg>';
const BGS=(()=>{let d='';for(let r=0;r<4;r++)for(let c=0;c<5;c++)d+=`<circle cx="${28+c*17}" cy="${300+r*17}" r="2.6"/>`;
  return `<svg class="sy-bg" viewBox="0 0 640 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<circle cx="40" cy="30" r="150" style="fill:var(--sy-bl)" opacity=".7"/>
<g opacity=".5" fill="none" style="stroke:var(--sy-w2)" stroke-width="5"><rect x="520" y="40" width="150" height="150" rx="16"/><path d="M520 80h150M560 28v26M630 28v26"/></g>
<g opacity=".4" style="fill:var(--sy-w2)"><rect x="540" y="96" width="30" height="24" rx="5"/><rect x="590" y="96" width="30" height="24" rx="5"/><rect x="540" y="136" width="30" height="24" rx="5"/><rect x="590" y="136" width="30" height="24" rx="5"/></g>
<g style="fill:var(--sy-dot)">${d}</g>
<path d="M300 420C400 340 470 400 640 300V420Z" style="fill:var(--sy-w1)" opacity=".8"/><path d="M380 420C470 370 540 410 640 350V420Z" style="fill:var(--sy-w2)"/></svg>`})();
function scene(inner){
  css();let o=document.getElementById('syncov');
  if(!o){o=document.createElement('div');o.id='syncov';document.body.appendChild(o)}
  o.innerHTML=BGS+`<img class="sy-lg" src="assets/logo-bunga.png" alt="" width="96" height="64"><h1 class="sy-h">Absensi Karyawan</h1><p class="sy-p">PT. Diansari Puri Plastindo</p>`+inner;
  return o;
}
const msg=t=>scene(`<div class="sy-t">${E(t)}</div>`);
const hideOv=()=>{const o=document.getElementById('syncov');if(o)o.remove()};
function portalView(cfg,m){
  const kep=m&&!m.isAdmin;
  scene((PM?`<div class="sy-m">${E(PM)}</div>`:'')+`<div class="sy-card"><button class="sy-b on" id="pc_a" type="button">${USR}Admin</button><a class="sy-b off" id="pc_k" href="spl.html">${FAC}SPL</a></div>`
    +(kep?`<a class="sy-lk" id="pc_sw" href="#">Masuk sebagai ${E(Cloud.cap(m.username))} · Ganti akun</a>`:''));
  document.getElementById('pc_a').onclick=()=>loginView(cfg);
  const sw=document.getElementById('pc_sw');if(sw)sw.onclick=async e=>{e.preventDefault();try{await Cloud.logout()}catch(x){}portalView(cfg,null)};
}
function loginView(cfg,err){
  scene(`<form class="sy-card sy-col" id="sy_f" autocomplete="on">
    <input class="sy-in" id="sy_u" name="username" placeholder="Nama pengguna" aria-label="Nama pengguna" autocomplete="username" autocapitalize="none">
    <input class="sy-in" id="sy_p" name="password" type="password" placeholder="Sandi" aria-label="Sandi" autocomplete="current-password">
    <div class="sy-er" id="sy_e">${E(err||'')}</div>
    <button class="sy-go" id="sy_go" type="submit">Masuk</button>
    <a class="sy-lk" id="sy_bk" href="#">← Kembali</a></form>`);
  document.getElementById('sy_bk').onclick=e=>{e.preventDefault();portalView(cfg,null)};
  document.getElementById('sy_f').onsubmit=async e=>{
    e.preventDefault();
    const u=document.getElementById('sy_u').value,p=document.getElementById('sy_p').value,b=document.getElementById('sy_go');
    b.disabled=true;b.textContent='Memeriksa…';
    try{
      const m=await Cloud.login(u,p);
      if(!m.isAdmin){await Cloud.logout();return loginView(cfg,'Akun ini bukan admin. Untuk SPL, pilih tombol SPL.')}
      loadAll(cfg,m);
    }catch(x){loginView(cfg,x.message)}
  };
  document.getElementById('sy_p').focus();
}
function failView(cfg,m){
  scene(`<div class="sy-card sy-col"><div class="sy-er" style="display:block">${E(m)}</div><div class="sy-t" style="font-size:13px">Periksa koneksi internet lalu coba lagi. Data tidak diubah.</div><button class="sy-go" id="sy_re" type="button">Coba lagi</button></div>`);
  document.getElementById('sy_re').onclick=()=>start(cfg);
}
function clearCache(){try{sessionStorage.removeItem(CK);sessionStorage.removeItem(KEY);localStorage.removeItem(CK);localStorage.removeItem(KEY)}catch(x){}}
let idleOn=false;
function startIdle(){
  if(idleOn||!window.Idle)return;idleOn=true;
  Idle.start(async()=>{try{if(dirty||busy||timer)await flush()}catch(e){}try{await Cloud.logout()}catch(e){}clearCache()});
}
let PM='';
async function logoutNow(){
  if(busy||dirty||timer){await flush()}
  if(failed||dirty){if(!confirm('Ada perubahan yang belum tersimpan ke server. Tetap keluar?'))return}
  try{await Cloud.logout()}catch(x){}
  clearCache();
  location.reload();
}
function wireHeader(name){
  if(name)userName=name;
  const n=document.getElementById('whon'),i=document.getElementById('whoi'),o=document.getElementById('sy-out');
  if(n&&userName)n.textContent=userName;
  if(i&&userName)i.textContent=userName.charAt(0).toUpperCase();
  if(o){o.hidden=false;o.onclick=logoutNow}
}
function stat(k,msg){
  const d=document.getElementById('sd'),e=document.getElementById('se');
  if(d){d.className='sd'+(k==='ok'?'':' '+k);d.title={ok:'Tersimpan di server',wait:'Menyimpan…',err:'Gagal menyimpan',off:'Tidak terhubung ke server'}[k]||''}
  if(e)e.textContent=k==='err'?(msg||'Gagal menyimpan'):(k==='off'?'Tidak terhubung':'');
}
window.addEventListener('beforeunload',e=>{if(dirty||busy||timer||failed){e.preventDefault();e.returnValue=''}});

/* ---------- alur mulai ---------- */
async function bg(cfg){
  let m;
  try{m=await Cloud.ready()}catch(e){stat('off');setTimeout(()=>bg(cfg),15000);return}
  if(!m||!m.isAdmin){portalView(cfg,m);return}
  wireHeader(Cloud.cap(m.username));
  try{
    const docs=await Cloud.dSince(Math.max(0,lastAt-MARGIN));
    if(apply(docs))rerender();
  }catch(e){stat('err',e.message);setTimeout(()=>bg(cfg),15000);return}
  synced=true;stat(dirty?'wait':'ok');startIdle();
  try{await Cloud.dListen(Math.max(0,lastAt-MARGIN),docs=>{queue.push(...docs);drain()},e=>stat('err',e.message))}catch(e){}
  if(dirty)flush();
}
async function start(cfg){
  PM=(window.Idle&&Idle.takeMsg())||'';
  try{localStorage.removeItem(KEY);localStorage.removeItem(CK)}catch(e){}   /* sisa data lama di disk dibersihkan */
  let c0=null;try{c0=JSON.parse(sessionStorage.getItem(CK)||'null');const sj=sessionStorage.getItem(KEY);if(c0&&c0.at&&sj)S=migrate(JSON.parse(sj));else c0=null}catch(e){c0=null}
  if(c0&&c0.at&&S&&S.emps){
    /* tampilkan langsung dari data tersimpan, server diperiksa di latar belakang */
    lastAt=c0.at;SH=shadowOf(split(S));userName=c0.u||'';
    hideOv();_boot(cfg);wireHeader();stat('wait');
    bg(cfg);return;
  }
  msg('Menghubungkan ke server…');
  let m;
  try{m=await Cloud.ready()}catch(e){return failView(cfg,e.message)}
  if(!m||!m.isAdmin)return portalView(cfg,m);
  loadAll(cfg,m);
}
async function loadAll(cfg,m){
  userName=Cloud.cap(m.username);
  msg('Memuat data dari server…');
  let c=null;try{c=JSON.parse(sessionStorage.getItem(CK)||'null')}catch(e){}
  try{
    if(c&&c.at&&S&&S.emps){
      lastAt=c.at;SH=shadowOf(split(S));
      apply(await Cloud.dSince(Math.max(0,c.at-MARGIN)));
    }else{
      S=blank();SH=new Map();lastAt=0;
      const docs=await Cloud.dSince(0);
      apply(docs);
      if(!docs.length){synced=true;dirty=true;await flush();if(failed)throw new Error('Gagal menyimpan data awal ke server.')}
      else cache();
    }
  }catch(e){return failView(cfg,e.message)}
  synced=true;startIdle();hideOv();_boot(cfg);wireHeader();stat(failed?'err':'ok');
  try{await Cloud.dListen(Math.max(0,lastAt-MARGIN),docs=>{queue.push(...docs);drain()},e=>stat('err',e.message))}catch(e){}
}

/* ---------- pasang ---------- */
window.boot=function(cfg){start(cfg)};
save=save2;
})();
