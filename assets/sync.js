/* sync.js — data admin disimpan di server (Firebase) supaya sama di semua komputer.
   Login admin wajib. Perubahan disimpan otomatis; perubahan komputer lain masuk otomatis. */
(window.APPV=window.APPV||{}).sync='1.0';
(function(){
if(typeof boot==='undefined'||typeof S==='undefined'||!window.Cloud)return;
const CK='absensi-sync-at',MARGIN=600000;
const _boot=boot;
let SH=new Map(),lastAt=0,dirty=false,busy=false,timer=null,failed=false,queue=[],rr=false,userName='';
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
function save2(){dirty=true;clearTimeout(timer);timer=setTimeout(flush,700);stat('wait')}
async function flush(){
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
  try{localStorage.setItem(KEY,JSON.stringify(S));localStorage.setItem(CK,JSON.stringify({at:lastAt}))}
  catch(e){try{localStorage.removeItem(CK)}catch(x){}}
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
function ov(html){
  let o=document.getElementById('syncov');
  if(!o){o=document.createElement('div');o.id='syncov';
    o.style.cssText='position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--ui);color:var(--ink)';
    document.body.appendChild(o)}
  o.innerHTML='<div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:24px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px">'+html+'</div>';
  return o;
}
const hideOv=()=>{const o=document.getElementById('syncov');if(o)o.remove()};
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FS='width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;margin-top:4px';
const BT='padding:10px 14px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:600;cursor:pointer';
function loginView(cfg,msg){
  ov(`<div style="font-size:18px;font-weight:700">Masuk admin</div>
   <div style="color:var(--muted);font-size:14px">Data absensi disimpan di server dan sama di semua komputer. Masuk dulu untuk membukanya.</div>
   <label style="font-size:13px">Nama pengguna<input id="sy_u" style="${FS}" value="${E(window.FB_ADMIN||'admin')}" autocomplete="username" autocapitalize="none"></label>
   <label style="font-size:13px">Sandi<input id="sy_p" type="password" style="${FS}" autocomplete="current-password"></label>
   <div id="sy_e" style="color:var(--bad);font-size:13px;min-height:16px">${E(msg||'')}</div>
   <button id="sy_go" style="${BT}">Masuk</button>
   <a href="spl" style="font-size:13px;color:var(--accent)">Saya kepala produksi (isi SPL)</a>`);
  const go=async()=>{
    const u=document.getElementById('sy_u').value,p=document.getElementById('sy_p').value;
    const b=document.getElementById('sy_go');b.disabled=true;b.textContent='Memeriksa…';
    try{
      const m=await Cloud.login(u,p);
      if(!m.isAdmin){await Cloud.logout();return loginView(cfg,'Akun ini bukan admin.')}
      loadAll(cfg,m);
    }catch(e){loginView(cfg,e.message)}
  };
  document.getElementById('sy_go').onclick=go;
  document.getElementById('sy_p').onkeydown=e=>{if(e.key==='Enter')go()};
  const p=document.getElementById('sy_p');if(p)p.focus();
}
function failView(cfg,msg){
  ov(`<div style="font-size:18px;font-weight:700">Tidak bisa terhubung</div>
   <div style="color:var(--bad);font-size:14px">${E(msg)}</div>
   <div style="color:var(--muted);font-size:13px">Periksa koneksi internet, lalu coba lagi. Data tidak diubah.</div>
   <button id="sy_re" style="${BT}">Coba lagi</button>`);
  document.getElementById('sy_re').onclick=()=>start(cfg);
}
function pill(){
  let p=document.getElementById('syncpill');
  if(!p){p=document.createElement('div');p.id='syncpill';
    p.style.cssText='position:fixed;left:12px;bottom:12px;z-index:50;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font:12px var(--ui);color:var(--muted);box-shadow:var(--shadow);display:flex;gap:8px;align-items:center';
    p.innerHTML='<span id="sp_t"></span><a id="sp_o" href="#" style="color:var(--accent)">Keluar</a>';
    document.body.appendChild(p);
    document.getElementById('sp_o').onclick=async e=>{e.preventDefault();
      if(busy||dirty||timer){await flush()}
      if(failed){if(!confirm('Ada perubahan yang belum tersimpan ke server. Tetap keluar?'))return}
      try{await Cloud.logout()}catch(x){}
      try{localStorage.removeItem(CK);localStorage.removeItem(KEY)}catch(x){}
      location.reload()};
  }
  return p;
}
function stat(k,msg){
  const p=pill(),t=document.getElementById('sp_t');
  const c={ok:'var(--good)',wait:'var(--warn)',err:'var(--bad)'}[k];
  const tx={ok:'Tersimpan di server',wait:'Menyimpan…',err:'Gagal menyimpan, mencoba lagi… '+(msg||'')}[k];
  t.innerHTML='<span style="color:'+c+'">●</span> '+E(tx)+(userName?' · '+E(userName):'');
}
window.addEventListener('beforeunload',e=>{if(dirty||busy||timer||failed){e.preventDefault();e.returnValue=''}});

/* ---------- alur mulai ---------- */
async function start(cfg){
  ov('<div style="color:var(--muted)">Menghubungkan ke server…</div>');
  let m;
  try{m=await Cloud.ready()}catch(e){return failView(cfg,e.message)}
  if(!m)return loginView(cfg);
  if(!m.isAdmin){
    ov(`<div style="font-size:18px;font-weight:700">Akun ini bukan admin</div>
      <div style="color:var(--muted);font-size:14px">Akun ${E(m.username)} hanya untuk mengisi SPL.</div>
      <a href="spl" style="${BT};text-align:center;text-decoration:none">Ke halaman SPL</a>
      <button id="sy_sw" style="padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);font:inherit;cursor:pointer">Ganti akun</button>`);
    document.getElementById('sy_sw').onclick=async()=>{try{await Cloud.logout()}catch(x){}loginView(cfg)};
    return;
  }
  loadAll(cfg,m);
}
async function loadAll(cfg,m){
  userName=Cloud.cap(m.username);
  ov('<div style="color:var(--muted)">Memuat data dari server…</div>');
  let c=null;try{c=JSON.parse(localStorage.getItem(CK)||'null')}catch(e){}
  try{
    if(c&&c.at&&S&&S.emps){
      lastAt=c.at;SH=shadowOf(split(S));
      apply(await Cloud.dSince(Math.max(0,c.at-MARGIN)));
    }else{
      S=blank();SH=new Map();lastAt=0;
      const docs=await Cloud.dSince(0);
      apply(docs);
      if(!docs.length){dirty=true;await flush();if(failed)throw new Error('Gagal menyimpan data awal ke server.')}
      else cache();
    }
  }catch(e){return failView(cfg,e.message)}
  hideOv();stat(failed?'err':'ok');
  _boot(cfg);
  try{await Cloud.dListen(Math.max(0,lastAt-MARGIN),docs=>{queue.push(...docs);drain()},e=>stat('err',e.message))}catch(e){}
}

/* ---------- pasang ---------- */
window.boot=function(cfg){start(cfg)};
save=save2;
})();
