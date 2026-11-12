/* cloud.js — penghubung ke Firebase (login dan SPL bersama). Dimuat lewat internet saat dibutuhkan. */
(window.APPV=window.APPV||{}).cloud='1.0';
(function(){
  const VER='10.12.2',BASE='https://www.gstatic.com/firebasejs/'+VER+'/';
  let M=null,auth=null,db=null;
  const dom=()=>window.FB_DOMAIN||'absensi.local';
  const mailOf=u=>String(u||'').trim().toLowerCase().replace(/\s+/g,'')+'@'+dom();
  const unameOf=em=>String(em||'').split('@')[0];
  const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
  async function load(){
    if(M)return M;
    if(!window.FB_CONFIG)throw new Error('Pengaturan Firebase belum ada (assets/firebase-config.js).');
    const [a,au,fs]=await Promise.all([import(BASE+'firebase-app.js'),import(BASE+'firebase-auth.js'),import(BASE+'firebase-firestore.js')]);
    const app=a.initializeApp(window.FB_CONFIG);
    auth=au.getAuth(app);db=fs.getFirestore(app);M={au,fs};
    return M;
  }
  function me(){
    const u=auth&&auth.currentUser;if(!u)return null;
    const un=unameOf(u.email);
    return {username:un,email:u.email,isAdmin:un===(window.FB_ADMIN||'admin')};
  }
  function nice(e){
    const c=(e&&e.code)||'';
    if(/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c))return 'Nama pengguna atau sandi salah.';
    if(/too-many-requests/.test(c))return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
    if(/network|unavailable/.test(c))return 'Tidak ada koneksi internet atau layanan sedang gangguan.';
    if(/permission-denied/.test(c))return 'Akses ditolak. Akun ini belum diizinkan, hubungi admin.';
    if(/unauthorized-domain/.test(c))return 'Alamat situs belum diizinkan di Firebase (Authentication, Settings, Authorized domains).';
    return (e&&e.message)||'Terjadi kesalahan.';
  }
  async function ready(){
    const {au}=await load();
    await new Promise(res=>{const off=au.onAuthStateChanged(auth,()=>{off();res()})});
    return me();
  }
  async function login(user,pass){
    const {au}=await load();
    try{await au.signInWithEmailAndPassword(auth,mailOf(user),pass)}catch(e){throw new Error(nice(e))}
    return me();
  }
  async function logout(){const {au}=await load();await au.signOut(auth)}
  const wrap=async f=>{try{return await f()}catch(e){throw new Error(nice(e))}};
  async function employees(){
    return wrap(async()=>{const {fs}=await load();const s=await fs.getDoc(fs.doc(db,'meta','employees'));
      return s.exists()?s.data():{list:[],names:{}}});
  }
  async function pushEmployees(list){
    return wrap(async()=>{const {fs}=await load();await fs.setDoc(fs.doc(db,'meta','employees'),{list,at:Date.now()},{merge:true})});
  }
  async function getAkses(){
    return wrap(async()=>{const {fs}=await load();const s=await fs.getDoc(fs.doc(db,'meta','akses'));
      return s.exists()?s.data():{users:[],names:{}}});
  }
  async function setAkses(users,names){
    return wrap(async()=>{const {fs}=await load();
      await fs.setDoc(fs.doc(db,'meta','akses'),{users,names});
      await fs.setDoc(fs.doc(db,'meta','employees'),{names},{merge:true})});
  }
  async function addSpl(d){
    return wrap(async()=>{const {fs}=await load();const m=me();
      const doc={date:d.date,start:d.start,end:d.end,reason:d.reason,note:d.note||'',dept:d.dept||'',emps:d.emps,imported:false,by:d.by||cap(m.username),byUser:m.username,atMs:Date.now()};
      const r=await fs.addDoc(fs.collection(db,'spl'),doc);return r.id});
  }
  async function mySpl(){
    return wrap(async()=>{const {fs}=await load();const m=me();
      const q=fs.query(fs.collection(db,'spl'),fs.where('byUser','==',m.username));
      const s=await fs.getDocs(q);return s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.atMs||0)-(a.atMs||0)).slice(0,30)});
  }
  async function pending(){
    return wrap(async()=>{const {fs}=await load();
      const q=fs.query(fs.collection(db,'spl'),fs.where('imported','==',false));
      const s=await fs.getDocs(q);return s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(a.atMs||0)-(b.atMs||0))});
  }
  async function since(ms){
    return wrap(async()=>{const {fs}=await load();
      const q=fs.query(fs.collection(db,'spl'),fs.where('atMs','>',ms||0));
      const r=await fs.getDocs(q);return r.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(a.atMs||0)-(b.atMs||0))});
  }
  async function markImported(id,localId){
    return wrap(async()=>{const {fs}=await load();await fs.updateDoc(fs.doc(db,'spl',id),{imported:true,localId})});
  }
  window.Cloud={ready,login,logout,me,employees,pushEmployees,getAkses,setAkses,addSpl,mySpl,pending,since,markImported,cap};
})();
