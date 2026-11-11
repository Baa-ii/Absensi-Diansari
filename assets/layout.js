/* layout.js — kerangka halaman (bar atas, menu, panel kiri), kotak cari, rincian karyawan, dialog, dan penanganan klik */
(window.APPV=window.APPV||{}).layout='1.1';
const SEC=[
 {k:'beranda',t:'Beranda',items:[{v:'ringkasan',href:'index.html',t:'Ringkasan harian'}]},
 {k:'absensi',t:'Absensi',items:[{v:'rekap',href:'rekap.html',t:'Rekap & tarikan'},{v:'impor',href:'impor-fingerprint.html',t:'Impor fingerprint'}]},
 {k:'lembur',t:'Lembur & SPL',items:[{v:'lembur',sub:'semua',href:'lembur.html#semua',t:'Semua SPL'},{v:'lembur',sub:'dibatalkan',href:'lembur.html#dibatalkan',t:'Dibatalkan'}]},
 {k:'karyawan',t:'Karyawan',items:[{v:'karyawan',href:'karyawan.html',t:'Daftar karyawan'},{v:'impor-karyawan',href:'impor-karyawan.html',t:'Impor karyawan'}]},
 {k:'pengaturan',t:'Pengaturan',items:[{v:'pengaturan',sub:'jam',href:'pengaturan.html#jam',t:'Jam kerja'},{v:'pengaturan',sub:'aturan',href:'pengaturan.html#aturan',t:'Aturan & tarif'},{v:'pengaturan',sub:'libur',href:'pengaturan.html#libur',t:'Hari libur'},{v:'pengaturan',sub:'data',href:'pengaturan.html#data',t:'Data & cadangan'}]}];
const secOf=v=>SEC.find(s=>s.items.some(i=>i.v===v));
const V={},LST={},ACT={},BIND={},PAGE={view:'',getSub:null,after:null,need:null};

/* ---------- pembangun tampilan bersama ---------- */
const depts=()=>[...new Set(S.emps.map(e=>e.dept))].sort();
const PAYS=['Mingguan','2 mingguan','Bulanan'];
const deptOpts=sel=>'<option value="">Semua departemen</option>'+depts().map(d=>`<option ${d===sel?'selected':''}>${esc(d)}</option>`).join('');
const payOpts=sel=>'<option value="">Semua kelompok gaji</option>'+PAYS.map(d=>`<option ${d===sel?'selected':''}>${d}</option>`).join('');
const PS=40;
function pager(total,top){const pages=Math.max(1,Math.ceil(total/PS));if(ui.page>=pages)ui.page=pages-1;
  return `<div class="pager${top?' top':''}"><span>${total?ui.page*PS+1:0}–${Math.min(total,(ui.page+1)*PS)} dari ${total}</span><span class="tools"><button class="btn sm" data-act="prev" ${ui.page<=0?'disabled':''}>Sebelumnya</button><button class="btn sm" data-act="next" ${ui.page>=pages-1?'disabled':''}>Berikutnya</button></span></div>`}
const matchQ=e=>(!ui.dept||e.dept===ui.dept)&&(!ui.pay||e.pay===ui.pay)&&(!ui.q||(e.name+' '+e.id+' '+e.pos).toLowerCase().includes(ui.q.toLowerCase()));
const sw=(bind,id,on,extra='',label='')=>`<label class="sw"><input type="checkbox" data-bind="${bind}" data-id="${esc(id)}" ${extra} ${on?'checked':''} aria-label="${label}"><i></i></label>`;
const tb=(title,right='',sub='')=>`<section class="panel tb"><div><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div><div class="tools">${right}</div></section>`;
const rangeCtl=()=>`<input type="date" id="from" data-bind="from" value="${ui.from}" aria-label="Dari tanggal"><span class="muted">sampai</span><input type="date" id="to" data-bind="to" value="${ui.to}" aria-label="Sampai tanggal"><select id="preset" data-bind="preset" aria-label="Pilih cepat"><option value="">Pilih cepat</option><option value="tw">Minggu ini</option><option value="lw">Minggu lalu (Sen–Min)</option><option value="14">14 hari terakhir</option><option value="cur">Bulan ini</option><option value="prev">Bulan lalu</option></select>`;
const schedText=e=>e.sched==='bergilir'?'Shift bergilir':'Tetap '+shiftOf(e).name;
function colName(im,i){const h=im.head;return h&&h[i]?h[i]:'Kolom '+(i+1)}
function colOpts(im,sel,none){return (none?`<option value="-1" ${sel<0?'selected':''}>${none}</option>`:'')+Array.from({length:im.ncol},(_,i)=>`<option value="${i}" ${i===sel?'selected':''}>${esc(colName(im,i))}</option>`).join('')}
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2400)}
const layer=()=>$('#layer');
function closeAll(){ui.drawer=null;layer().innerHTML=''}
function modal(html){layer().innerHTML=`<div class="over-ov" data-act="ovclick"><div class="modal" role="dialog">${html}</div></div>`}
function drawerHTML(e){
  const days=rangeDays(),o=recap(e,days);
  return `<div class="drawer" role="dialog" aria-label="Detail absensi"><div class="tb" style="padding:0"><div><h1>${esc(e.name)}</h1><p class="sub">${esc(e.id)} · ${esc(e.dept)}${e.pos?' · '+esc(e.pos):''} · ${schedText(e)} · gaji ${esc(e.pay.toLowerCase())} · ${e.ot?'berhak lembur':'tidak berhak lembur'} · ${rp(rateOf(e))}/jam</p></div><button class="btn" data-act="closedrawer">Tutup</button></div>
  <div class="tools"><span class="muted">Periode</span><input type="date" id="dfrom" data-bind="from" value="${ui.from}" aria-label="Dari tanggal"><span class="muted">sampai</span><input type="date" id="dto" data-bind="to" value="${ui.to}" aria-label="Sampai tanggal"></div>
  <div class="stats"><div class="stat g"><b>${o.hadir}</b><span>Hadir</span></div><div class="stat w"><b>${o.telat}</b><span>Telat</span></div><div class="stat b"><b>${o.alpa}</b><span>Alpa</span></div><div class="stat"><b>${fmtH(o.otMin)}</b><span>Jam lembur dibayar</span></div><div class="stat"><b style="font-size:20px">${rp(o.amt)}</b><span>Estimasi lembur</span></div></div>
  <div class="scroll panel"><table><thead><tr><th>Tanggal</th><th>Shift</th><th>Masuk</th><th>Pulang</th><th>Status</th><th class="n">Lembur nyata</th><th>SPL</th><th class="n">Dibayar</th><th class="n">Estimasi</th></tr></thead><tbody>
  ${days.map(ds=>{const i=dayInfo(e,ds),r=i.r,wk=[0,6].includes(pd(ds).getDay());
   const shiftCell=i.rot?(r.in?`<select data-bind="shov" data-ds="${ds}" aria-label="Shift ${ds}"><option value="">${esc(i.sh.name)}${r.shov?'':' (otomatis)'}</option>${S.set.shifts.filter(s=>s.rot&&s.id!==(r.shov||'')).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}${r.shov?'<option value="__auto">Kembali otomatis</option>':''}</select>${i.un?' <span class="pill warn">cek</span>':''}`:'<span class="muted">—</span>'):`<span class="muted">${esc(i.sh.name)}</span>`;
   return `<tr class="${(i.hol||wk)&&!r.in?'off':''}"><td>${fmtDate(ds)}</td><td>${shiftCell}</td><td class="n">${r.in||'—'}</td><td class="n">${r.n>1?r.out+(r.nd?' +1':''):'—'}</td>
   <td><select data-bind="ov" data-ds="${ds}" aria-label="Status ${ds}"><option value="">${i.status}${r.ov?'':' (otomatis)'}</option>${r.ov?'<option value="__auto">Kembali ke otomatis</option>':''}${['Hadir','Izin','Sakit','Cuti','Dinas Luar','Alpa'].filter(x=>x!==r.ov).map(x=>`<option>${x}</option>`).join('')}</select></td>
   <td class="n">${i.ot?fmtH(i.ot)+' j':'—'}</td><td>${i.spl?`<span class="pill good">${i.spl.start}–${i.spl.end}</span><br><span class="muted mono" style="font-size:11px">${esc(i.spl.id)}</span>`:i.flag?`<span class="pill ${i.flag==='Tanpa SPL'?'warn':'bad'}">${i.flag}</span>`:'—'}</td><td class="n">${i.paid?fmtH(i.paid)+' j':'—'}</td><td class="n">${i.paid?rp(i.amt):'—'}</td></tr>`}).join('')}</tbody></table></div></div>`;
}
function viewSpl(id){
  const s=S.spl.find(x=>x.id===id);if(!s)return;
  const EM=EMap(),emps=s.emps.map(i=>EM.get(i)||{id:i,name:'(karyawan sudah dihapus)',dept:''});
  modal(`<div class="tb" style="padding:0"><h1>Surat Perintah Lembur</h1><button class="btn" data-act="closemodal">Tutup</button></div>
  <div class="letter"><div class="tools" style="justify-content:space-between"><span class="mono">${esc(s.id)}</span><span class="pill ${s.status==='Disetujui'?'good':s.status==='Dibatalkan'?'bad':'warn'}">${s.status}</span></div>
  <div>Memerintahkan karyawan berikut untuk bekerja lembur pada shift tanggal <b>${fmtDate(s.date)}</b>, pukul <b class="mono">${s.start}–${s.end}</b> (${fmtH(dur(s))} jam).</div>
  <div class="muted">Pekerjaan: ${esc(s.reason)}</div>${s.note?`<div class="muted">Keterangan: ${esc(s.note)}</div>`:''}${s.ed?`<div class="muted">Diubah terakhir: ${esc(s.ed)}</div>`:''}
  <div>Perkiraan biaya maksimal: <b class="mono">${rp(splCost(s,EM))}</b> <span class="muted">(${s.emps.length} orang × ${fmtH(dur(s))} jam, tarif per karyawan)</span></div>
  <div class="scroll"><table><tbody>${emps.map((e,i)=>`<tr><td class="n dim">${i+1}</td><td>${esc(e.name)}</td><td class="mono dim">${esc(e.id)}</td><td class="dim">${esc(e.dept)}</td><td class="n dim">${rp(rateOf(e))}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="tools" style="justify-content:flex-end"><button class="btn" data-act="copyspl" data-id="${esc(s.id)}">Salin teks SPL</button></div>`);
}
function splText(s){const EM=EMap(),emps=s.emps.map(i=>EM.get(i)||{id:i,name:'(karyawan sudah dihapus)',dept:''});
  return `SURAT PERINTAH LEMBUR\nNo: ${s.id}\nTanggal shift: ${fmtDate(s.date)}\nJam: ${s.start}-${s.end}\nPekerjaan: ${s.reason}\nStatus: ${s.status}\n\nKaryawan:\n`+emps.map((e,i)=>`${i+1}. ${e.name} (${e.id}) - ${e.dept}`).join('\n')}
function copyText(t,msg){
  const fb=()=>modal(`<div class="tb" style="padding:0"><h1>Salin manual</h1><button class="btn" data-act="closemodal">Tutup</button></div><textarea id="cp" rows="10" style="font-family:var(--num);font-size:12px">${esc(t)}</textarea><p class="sub">Pilih semua teks di atas lalu salin.</p>`);
  try{navigator.clipboard.writeText(t).then(()=>toast(msg),fb)}catch(e){fb()}
}
function download(name,text,type){
  try{const b=new Blob(['﻿'+text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();toast('File diunduh')}
  catch(e){copyText(text,'Unduhan tidak tersedia, teks disalin')}
}
function wireDrop(dz,fi,fn){
  const z=$(dz),f=$(fi);if(!z||!f)return;
  f.onchange=()=>f.files[0]&&fn(f.files[0]);
  ['dragover','dragenter'].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();z.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();z.classList.remove('over')}));
  z.addEventListener('drop',e=>{const x=e.dataTransfer.files[0];if(x)fn(x)});
}
function gsearch(v){
  const box=$('#gsr');if(!v.trim()){box.hidden=true;return}
  const q=v.toLowerCase(),rows=S.emps.filter(e=>(e.name+' '+e.id).toLowerCase().includes(q)).slice(0,8);
  box.innerHTML=rows.map(e=>`<button data-act="gopen" data-id="${esc(e.id)}"><span><b>${esc(e.name)}</b> <span class="muted">${esc(e.id)}</span></span><span class="muted">${esc(e.dept)}${e.off?' \u00b7 nonaktif':''}</span></button>`).join('')||'<div class="empty" style="padding:12px">Tidak ditemukan.</div>';
  box.hidden=false;
}

/* ---------- kerangka dan render ---------- */
$('#app').innerHTML=`<header class="top"><div class="bar1"><a class="brand" href="index.html"><span class="mark">A</span>Absensi Karyawan</a><div class="search"><input type="text" id="gs" data-bind="gs" placeholder="Cari karyawan (nama atau ID)" autocomplete="off" aria-label="Cari karyawan"><kbd>Ctrl K</kbd><div class="sr" id="gsr" hidden></div></div><div class="utools"><button class="ib" data-act="theme" title="Ganti tema" aria-label="Ganti tema">&#9790;</button><div class="user"><i>HR</i><span>Admin HRD</span></div></div></div><nav class="menubar" id="menubar" aria-label="Menu utama"></nav></header><div class="crumb" id="crumb"></div><div class="shell"><aside class="side" id="side"></aside><main id="main"></main></div><footer class="ver" id="ver"></footer>`;
function refresh(){const l=$('#list');if(l&&LST[PAGE.view])l.innerHTML=LST[PAGE.view]()}
function render(){
  const cur=secOf(PAGE.view)||SEC[0],sub=PAGE.getSub?PAGE.getSub():null;
  $('#menubar').innerHTML=SEC.map(s=>`<a href="${s.items[0].href}" ${s===cur?'aria-current="page"':''}>${s.t}</a>`).join('');
  const item=cur.items.find(i=>i.v===PAGE.view&&(!i.sub||i.sub===sub))||cur.items[0];
  $('#crumb').innerHTML=`<a href="index.html">Beranda</a> \u203a ${cur.k==='beranda'?'<b>'+item.t+'</b>':cur.t+' \u203a <b>'+item.t+'</b>'}`;
  $('#side').innerHTML=`<div class="ent"><b>Absensi Karyawan</b><span>${actE().length} karyawan aktif</span></div><div class="sl"><h2>${cur.t}</h2>${cur.items.map(i=>`<a href="${i.href}" ${i===item?'aria-current="page"':''}>${i.t}</a>`).join('')}</div>`;
  const bad=PAGE.need?Object.keys(PAGE.need).filter(k=>APPV[k]!==PAGE.need[k]):[];
  $('#main').innerHTML=(bad.length?'<div class="banner bad">File aplikasi tidak cocok ('+bad.join(', ')+'). Unggah ulang seluruh folder assets bersama semua halaman, lalu muat ulang dengan Ctrl+F5.</div>':'')+(S.demo?'<div class="banner">Menampilkan data contoh. Hapus di Pengaturan, Data & cadangan, sebelum memakai data asli.</div>':'')+V[PAGE.view]();
  const d=ui.drawer&&S.emps.find(e=>e.id===ui.drawer);if(d){layer().innerHTML=`<div class="over-ov" data-act="ovclick" style="padding:0;justify-content:flex-end">${drawerHTML(d)}</div>`}
  $('#ver').textContent='Absensi Karyawan \u00b7 versi '+APPV.data+' \u00b7 data '+APPV.data+' \u00b7 tampilan '+APPV.layout;
  if(PAGE.after)PAGE.after();
  saveUi();
}
function boot(cfg){Object.assign(PAGE,cfg);ui.view=cfg.view;ui.page=0;render()}

/* ---------- aksi dan isian bersama ---------- */
Object.assign(ACT,{
  goto(a){location.href=a.dataset.href},
  theme(){const r=document.documentElement,cur=r.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'),nx=cur==='dark'?'light':'dark';r.dataset.theme=nx;try{localStorage.setItem('absensi-theme',nx)}catch(e){}},
  prev(){ui.page--;refresh()},next(){ui.page++;refresh()},
  open(a){ui.drawer=a.dataset.id;render()},gopen(a){ui.drawer=a.dataset.id;$('#gsr').hidden=true;$('#gs').value='';render()},
  closedrawer(){closeAll()},closemodal(){ui.editSpl=null;layer().innerHTML=''},
  ovclick(a,e){if(e.target===a){ui.drawer?closeAll():layer().innerHTML=''}},
  viewspl(a){viewSpl(a.dataset.id)},
  copyspl(a){copyText(splText(S.spl.find(x=>x.id===a.dataset.id)),'Teks SPL tersalin')},
  dlbackup(){download('cadangan-absensi-'+TODAY+'.json',JSON.stringify(S),'application/json')},
  copybackup(){copyText(JSON.stringify(S),'Cadangan tersalin')}
});
const LIVE=new Set(['gs','q','splq','delconf']);
Object.assign(BIND,{
  gs(t){gsearch(t.value)},
  q(t){ui.q=t.value;ui.page=0;refresh()},
  dept(t){ui.dept=t.value;ui.page=0;refresh()},
  pay(t){ui.pay=t.value;ui.page=0;refresh()},
  from(t){if(t.value){ui.from=t.value;if(ui.to<ui.from)ui.to=ui.from;ui.page=0;render()}},
  to(t){if(t.value){ui.to=t.value;if(ui.from>ui.to)ui.from=ui.to;ui.page=0;render()}},
  preset(t){const v=t.value,t0=pd(TODAY),mon=new Date(t0);mon.setDate(mon.getDate()-((mon.getDay()+6)%7));let f,end;
    if(v==='tw'){f=dstr(mon);end=TODAY}
    else if(v==='lw'){const a=new Date(mon);a.setDate(a.getDate()-7);const z=new Date(a);z.setDate(z.getDate()+6);f=dstr(a);end=dstr(z)}
    else if(v==='14'){const a=new Date(t0);a.setDate(a.getDate()-14);const z=new Date(t0);z.setDate(z.getDate()-1);f=dstr(a);end=dstr(z)}
    else if(v==='cur'){f=TODAY.slice(0,7)+'-01';end=TODAY}
    else if(v==='prev'){f=dstr(new Date(t0.getFullYear(),t0.getMonth()-1,1));end=dstr(new Date(t0.getFullYear(),t0.getMonth(),0))}
    if(f){ui.from=f;ui.to=end;ui.page=0;render()}},
  ov(t){const x=S.emps.find(y=>y.id===ui.drawer),k=x.id+'|'+t.dataset.ds,r=S.att[k]||(S.att[k]={});
    if(t.value==='__auto')delete r.ov;else if(t.value)r.ov=t.value;
    if(!Object.keys(r).length)delete S.att[k];save();render()},
  shov(t){const x=S.emps.find(y=>y.id===ui.drawer),k=x.id+'|'+t.dataset.ds,r=S.att[k]||(S.att[k]={});
    if(t.value==='__auto')delete r.shov;else if(t.value)r.shov=t.value;
    save();render()}
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.search'))$('#gsr').hidden=true;
  const a=e.target.closest('[data-act]');if(!a)return;
  if(e.target.closest('select,input,label.sw')&&a.dataset.act==='open')return;
  if(a.dataset.act==='selall'&&a.tagName!=='INPUT')return;
  const f=ACT[a.dataset.act];if(f)f(a,e)});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#gs').focus()}});
function onBind(e){
  const t=e.target,b=t.dataset.bind;if(!b)return;
  if((e.type==='input')!==LIVE.has(b))return;
  const f=BIND[b];if(f)f(t,e);
}
document.addEventListener('input',onBind);document.addEventListener('change',onBind);
try{const th=localStorage.getItem('absensi-theme');if(th)document.documentElement.dataset.theme=th}catch(e){}
