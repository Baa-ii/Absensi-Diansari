/* data.js — penyimpanan data, aturan absensi dan lembur, data contoh, pembaca file */
(window.APPV=window.APPV||{}).data='1.1';
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const toMin=t=>{if(!t)return null;const p=t.split(':');return +p[0]*60+ +p[1]};
const fromMin=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const pd=s=>{const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])};
const dayNum=s=>{const p=s.split('-').map(Number);return Math.round(Date.UTC(p[0],p[1]-1,p[2])/86400000)};
const numDate=n=>{const d=new Date(n*86400000);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())};
const HARI=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const BULAN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtDate=ds=>{const d=pd(ds);return HARI[d.getDay()]+', '+d.getDate()+' '+BULAN[d.getMonth()].slice(0,3)+' '+d.getFullYear()};
const fmtH=m=>m?(m/60).toFixed(1).replace('.',','):'0';
const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const TODAY=dstr(new Date());
const normId=x=>String(x??'').trim().replace(/^0+(?=\d)/,'');
function rangeDays(){const out=[],b=pd(ui.to);for(let d=pd(ui.from),i=0;d<=b&&i<120;d.setDate(d.getDate()+1),i++)out.push(dstr(d));return out}

/* ---------- storage ---------- */
const KEY='absensi-karyawan-v3',OLDKEY='absensi-karyawan-v2';
function loadS(){for(const k of [KEY,OLDKEY]){try{const j=localStorage.getItem(k);if(j)return JSON.parse(j)}catch(e){}}return null}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function migrate(s){
  s.set=s.set||DEFAULT_SET();
  s.set.shifts.forEach(x=>{if(x.rot==null)x.rot=x.id!=='reg'});
  if(s.set.rate==null)s.set.rate=24000;
  s.set.holidays=s.set.holidays||[];
  s.emps=s.emps||[];
  s.emps.forEach(e=>{e.pos=e.pos||'';e.sched=e.sched||'tetap';e.pay=e.pay||'Bulanan';e.rate=+e.rate||0;e.off=!!e.off;e.ot=!!e.ot});
  s.att=s.att||{};s.spl=s.spl||[];s.imports=s.imports||[];
  s.spl.forEach(x=>{if(x.status==='Diajukan')x.status='Disetujui';else if(x.status==='Ditolak')x.status='Dibatalkan'});
  return s;
}
/* ---------- demo data ---------- */
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function DEFAULT_SET(){return {shifts:[{id:'reg',name:'Kantor',start:'08:00',end:'16:30',rot:false},{id:'pagi',name:'Shift 1',start:'07:00',end:'15:00',rot:true},{id:'siang',name:'Shift 2',start:'15:00',end:'23:00',rot:true},{id:'malam',name:'Shift 3',start:'23:00',end:'07:00',rot:true}],tol:10,minOT:30,rate:24000,sat:false,holidays:['2026-08-17','2026-12-25']}}
function demo(){
  const R=rng(7),set=DEFAULT_SET();
  const F=['Agus','Budi','Siti','Dewi','Rina','Andi','Eko','Wahyu','Fitri','Yusuf','Dian','Ratna','Hendra','Lestari','Joko','Sri','Rizki','Nur','Putri','Bayu','Indah','Dedi','Anisa','Taufik','Maya','Irfan','Yuni','Fajar','Ayu','Slamet'];
  const L=['Santoso','Pratama','Wijaya','Hidayat','Saputra','Kurniawan','Rahayu','Setiawan','Nugroho','Permana','Utami','Susanto','Ramadhan','Firmansyah','Hartono','Purnama','Wulandari','Maulana','Siregar','Kusuma'];
  const D=[['Produksi',90,.6,'Mingguan',['pagi','siang','malam']],['Gudang',36,.6,'2 mingguan',['pagi','siang']],['Maintenance',18,.6,'2 mingguan',['pagi','siang','malam']],
          ['Admin',22,.05,'Bulanan',null],['Keuangan',12,0,'Bulanan',null],['HRD',10,0,'Bulanan',null],['IT',8,.1,'Bulanan',null],['Marketing',28,.1,'Bulanan',null]];
  const emps=[],rot={};let n=1001;
  D.forEach(([dept,c,p,pay,rs])=>{for(let i=0;i<c;i++){
    const head=i===0,id=String(n++);
    emps.push({id,name:F[Math.floor(R()*F.length)]+' '+L[Math.floor(R()*L.length)],dept,pos:head?'Kepala':(rs?'Operator':'Staf'),
      sched:(rs&&!head)?'bergilir':'tetap',shift:'reg',pay,rate:head?35000:0,ot:head?true:R()<p,off:false});
    if(rs&&!head)rot[id]={rs,off:i};
  }});
  const att={},spl=[],otMap={};
  const t0=new Date(2026,9,1),t1=new Date(2026,10,6);
  for(let d=new Date(t0);d<=t1;d.setDate(d.getDate()+1)){
    const dow=d.getDay();if(dow===0||dow===6)continue;const ds=dstr(d),wk=Math.floor((dayNum(ds)-dayNum('2026-10-01'))/7);
    emps.forEach(e=>{
      const ro=rot[e.id],shId=ro?ro.rs[(wk+ro.off)%ro.rs.length]:'reg',sh=set.shifts.find(x=>x.id===shId);
      const s=toMin(sh.start),night=toMin(sh.end)<=s,en=toMin(sh.end)+(night?1440:0),r=R(),k=e.id+'|'+ds,ex=ro?{sh:shId}:{};
      if(r<.015)return;
      if(r<.035){att[k]={ov:['Sakit','Izin','Cuti'][Math.floor(R()*3)]};return}
      if(r<.05){const t=(s-Math.floor(R()*10)+1440)%1440;att[k]={in:fromMin(t),out:fromMin(t),n:1,...ex};return}
      const inM=Math.round(R()<.08?s+11+R()*40:s-R()*25);
      let outM=Math.round(en+R()*12-4);
      if(e.ot&&R()<.26){
        outM=Math.round(en+45+R()*150);
        const key=ds+'|'+e.dept+'|'+shId,o=otMap[key]=otMap[key]||{ds,dept:e.dept,sh,emps:[],max:0};
        o.max=Math.max(o.max,outM);if(R()<.78)o.emps.push(e.id);
      }
      att[k]={in:fromMin(((inM%1440)+1440)%1440),out:fromMin(outM%1440),n:2,...(outM>=1440?{nd:1}:{}),...ex};
    });
  }
  const cnt={};
  Object.values(otMap).filter(o=>o.emps.length).sort((a,b)=>a.ds<b.ds?-1:1).forEach(o=>{
    const mo=o.ds.slice(0,7);cnt[mo]=(cnt[mo]||0)+1;
    spl.push({id:'SPL/'+o.ds.slice(0,4)+'/'+o.ds.slice(5,7)+'/'+String(cnt[mo]).padStart(3,'0'),date:o.ds,start:o.sh.end,end:fromMin((Math.ceil(o.max/30)*30)%1440),
      reason:o.dept==='Produksi'?'Mengejar target produksi':o.dept==='Gudang'?'Bongkar muat kiriman tambahan':o.dept==='Maintenance'?'Perbaikan mesin di luar jam kerja':'Menyelesaikan pekerjaan mendesak',dept:o.dept,emps:o.emps,status:'Disetujui'});
  });
  const el=d=>emps.filter(e=>e.ot&&e.dept===d).slice(0,6).map(e=>e.id);
  spl.push({id:'SPL/2026/11/090',date:'2026-11-11',start:'17:00',end:'20:00',reason:'Pesanan mendadak, target kirim akhir pekan',dept:'Produksi',emps:el('Produksi'),status:'Disetujui'});
  spl.push({id:'SPL/2026/11/091',date:'2026-11-14',start:'08:00',end:'13:00',reason:'Stock opname akhir bulan',dept:'Gudang',emps:el('Gudang').slice(0,4),status:'Disetujui'});
  return migrate({demo:true,emps,att,spl,set,imports:[]});
}
let S=migrate(loadS()||demo());

/* ---------- business rules ---------- */
const actE=()=>S.emps.filter(e=>!e.off);
function shiftOf(e){return S.set.shifts.find(x=>x.id===e.shift)||S.set.shifts[0]}
function isNight(sh){return toMin(sh.end)<=toMin(sh.start)}
const dur=s=>(toMin(s.end)-toMin(s.start)+1440)%1440;
const rateOf=e=>e&&e.rate>0?e.rate:S.set.rate;
function isHoliday(ds){const dow=pd(ds).getDay();return S.set.holidays.includes(ds)||dow===0||(dow===6&&!S.set.sat)}
function detectShift(t){
  let c=S.set.shifts.filter(s=>s.rot);if(!c.length)c=S.set.shifts;
  let best=null;
  c.forEach(s=>{const diff=Math.abs(((t-toMin(s.start)+720)%1440+1440)%1440-720);if(!best||diff<best.dist)best={id:s.id,dist:diff}});
  return best;
}
function dayInfo(e,ds){
  const r=S.att[e.id+'|'+ds]||{},rot=e.sched==='bergilir',hol=rot?false:isHoliday(ds);
  const sh=(rot&&S.set.shifts.find(x=>x.id===(r.shov||r.sh)))||shiftOf(e);
  const night=isNight(sh),inM=toMin(r.in),outM=toMin(r.out)+(r.nd?1440:0),sEnd=toMin(sh.end)+(night?1440:0);
  const complete=r.n>1&&inM!=null&&outM-inM>=30;
  let status,late=0;
  if(r.ov)status=r.ov;
  else if(r.in){
    if(!complete)status='Tidak lengkap';
    else if(!hol&&inM>toMin(sh.start)+S.set.tol){status='Terlambat';late=inM-toMin(sh.start)}
    else status='Hadir';
  }else status=rot?(ds<TODAY?'Tanpa scan':'—'):hol?'Libur':(ds<TODAY?'Alpa':'—');
  let ot=0;
  if(complete&&!r.ov){
    if(hol){let w=outM-inM;if(w>300)w-=60;ot=w>=S.set.minOT?w:0}
    else{const x=outM-sEnd;ot=x>=S.set.minOT?x:0}
  }
  const spl=S.spl.find(s=>s.status==='Disetujui'&&s.date===ds&&s.emps.includes(e.id));
  let paid=0,flag='';
  if(ot>0){
    if(!spl)flag=e.ot?'Tanpa SPL':'Tidak berhak lembur';
    else if(!e.ot)flag='Tidak berhak lembur';
    else paid=Math.floor(Math.min(ot,dur(spl))/30)*30;
  }
  return {r,hol,sh,rot,status,late,ot,spl,paid,flag,un:rot&&!!r.un&&!r.shov,amt:paid/60*rateOf(e)};
}
function recap(e,days){
  const o={hadir:0,telat:0,izin:0,alpa:0,inc:0,noscan:0,un:0,otMin:0,amt:0,noSpl:0};
  days.forEach(ds=>{const i=dayInfo(e,ds);
    if(['Hadir','Terlambat','Dinas Luar'].includes(i.status))o.hadir++;
    if(i.status==='Terlambat')o.telat++;
    if(['Izin','Sakit','Cuti'].includes(i.status))o.izin++;
    if(i.status==='Alpa')o.alpa++;
    if(i.status==='Tanpa scan')o.noscan++;
    if(i.status==='Tidak lengkap')o.inc++;
    if(i.un)o.un++;
    o.otMin+=i.paid;o.amt+=i.amt;if(i.flag==='Tanpa SPL')o.noSpl++;});
  return o;
}
const pillCls=s=>({'Hadir':'good','Terlambat':'warn','Tidak lengkap':'warn','Alpa':'bad','Izin':'info','Sakit':'info','Cuti':'info','Dinas Luar':'info'}[s]||'');
const splCost=(s,EM)=>s.emps.reduce((a,id)=>a+rateOf(EM.get(id)),0)*dur(s)/60;
const EMap=()=>new Map(S.emps.map(e=>[e.id,e]));

/* ---------- state tampilan yang dibawa antar halaman ---------- */
function latest(){let m='';for(const k in S.att){const d=k.split('|')[1];if(d>m)m=d}return m||TODAY}
const L0=latest();
const UI_KEY='absensi-ui';
const ui={view:'',day:L0,from:L0.slice(0,7)+'-01',to:L0,q:'',dept:'',pay:'',showOff:false,page:0,drawer:null,splTab:'Semua',setTab:'jam',imp:null,ie:null,confirm:false,cd:false,cx:null,sel:new Set()};
try{const j=JSON.parse(sessionStorage.getItem(UI_KEY)||'null');if(j)['day','from','to','showOff'].forEach(k=>{if(j[k]!=null)ui[k]=j[k]})}catch(e){}
function saveUi(){try{sessionStorage.setItem(UI_KEY,JSON.stringify({day:ui.day,from:ui.from,to:ui.to,showOff:ui.showOff}))}catch(e){}}

/* ---------- pembaca file (dipakai halaman impor) ---------- */
function parseText(t){
  const lines=t.split(/\r?\n/).filter(l=>l.trim()),l0=lines[0]||'';
  const dl=l0.includes('\t')?'\t':l0.includes(';')?';':l0.includes(',')?',':/\s+/;
  return lines.map(l=>l.split(dl).map(x=>x.trim().replace(/^"|"$/g,'')));
}
async function readRows(f){
  const ext=f.name.split('.').pop().toLowerCase();
  if(ext==='xlsx'||ext==='xls'){
    if(!window.XLSX)throw new Error('Pustaka Excel belum termuat. Simpan file sebagai CSV lalu unggah lagi.');
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,dateNF:'yyyy-mm-dd hh:mm:ss',defval:''}).filter(r=>r.some(c=>String(c).trim()));
  }
  return parseText(await f.text());
}
