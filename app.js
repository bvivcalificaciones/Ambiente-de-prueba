/* Asoc. Bomberos Voluntarios Isla Verde · app de asistencia y guardias
   Los datos viven en Supabase; este archivo es la interfaz. Configuración en config.js. */
const MOTIVOS_DEF = ["Reunión Ordinaria","Reunión Extraordinaria","Mantenimiento/Laboral","Capacitación","BN1","Segundo Nivel","Tercer Nivel","Presencia en Actos","Reunión de Regional","DPTO K9","DPTO Fuego","DPTO Rescate Acuatico","DPTO Rescate Vehícular","DPTO VANT","Viaje","Eventos de Recaudación","Eventos Especiales","Cursos Especiales","Asistencia Federativa"];
const CAP = "Guardia · Capacitación", MANT = "Guardia · Mantenimiento/Limpieza";
const MOTIVOS_GUARDIA = [CAP, MANT];
// Actividades de asistencia general: se editan desde el Panel (o la PC del cuartel) y vienen de la base.
const motivosCfg=()=>Array.isArray(S.motivos)&&S.motivos.length?S.motivos:MOTIVOS_DEF.map(n=>({n,activo:true}));
const motivosActivos=()=>motivosCfg().filter(m=>m.activo!==false).map(m=>m.n);
// Para informes: todas las de la lista (activas o no) más cualquier nombre viejo que aparezca en los registros.
function motivosTodos(){const a=motivosCfg().map(m=>m.n);for(const r of S.horas)if(!MOTIVOS_GUARDIA.includes(r.m)&&!a.includes(r.m))a.push(r.m);return a}
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const START_NIGHT = "2026-04-15"; // primer noche con registros de guardia (inicio del historial importado)
const TZ = 'America/Argentina/Buenos_Aires';

/* ---------- dispositivo ---------- */
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
const KIOSK_KEY=()=>LS.get('bviv_kiosco');
const isKiosk=()=>!!KIOSK_KEY();

/* ---------- estado ---------- */
const S = {
  roster:[], guardias:[], horas:[], adentro:[], log:[],
  tab: isKiosk()?'kiosco':'guardia',
  sess:{kiosco:{step:'who',who:null,pin:'',q:''},guardia:{step:'who',who:null,pin:'',q:''},panel:{step:'who',who:null,pin:'',q:''},novedades:{step:'list',who:null,pin:'',q:''},sci:{step:'who',who:null,pin:'',q:''},alertas:{step:'who',who:null,pin:'',q:''},epp:{step:'who',who:null,pin:'',q:''}},
  mode:null, motivo:null, est:null,
  admin:null, ptab:'guardia', perms:{}, pmsg:null, editP:null,
  cfg:{reminder:'19:00',saverMin:2,kioskSec:60,appMin:3},
  news:[], tipos:[], editTipos:false, saver:false, month:null, gfilter:'all', ficha:null, loaded:false, busy:false
};

/* ---------- conexión con Supabase ---------- */
async function rpc(fn,args={}){
  let r;
  try{
    r=await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:CONFIG.SUPABASE_ANON_KEY,Authorization:'Bearer '+CONFIG.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(args)});
  }catch(e){const x=new Error('Sin conexión. Revisá internet y probá de nuevo.');x.code='RED';throw x}
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok){const x=new Error(j?.hint||j?.message||'Error del servidor.');x.code=j?.message;throw x}
  return j;
}
const tokNow=()=>sess()?.tok||(S.tab==='panel'?S.sess.panel.tok:null);
async function call(fn,args={}){
  try{return await rpc(fn,{tok:tokNow(),...args})}
  catch(e){
    if(e.code==='SESION_VENCIDA'){toast('Tu sesión venció. Ingresá tu PIN de nuevo.');S.admin=null;logoutSess();}
    else toast(e.message);
    throw e;
  }
}
const loc=ts=>{if(!ts)return null;const s=new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts));return s.replace(' ','T').slice(0,16)};
function applyPublic(p){
  const priv=new Map(S.roster.map(x=>[x.n,x]));
  if(!S.privRoster){
    S.roster=p.personas.map(x=>({id:x.id,n:x.n,cat:x.cat,g:x.g,cargo:x.cargo,activo:true}));
    S.perms={};p.personas.forEach(x=>{if(x.rol==='admin')S.perms[x.n]='admin';else if(x.rol&&x.rol.startsWith('sup'))S.perms[x.n]='sup'});
  }
  S.jer=Object.fromEntries(p.personas.map(x=>[x.n,x.jer||null]));
  S.adentro=p.adentro.map(x=>({b:x.b,m:x.m,i:loc(x.i)}));
  S.news=p.novedades.map(x=>({...x,ts:loc(x.ts),hasta:loc(x.hasta)}));
  S.tipos=p.tipos;
  S.sciCfg=p.sci||null;
  S.motivos=p.motivos||null;
  S.alertaTipos=p.alertaTipos||['Convocatoria','Búsqueda','Forestal','Inundación'];
  S.tonos=p.tonos||{amarilla:'bocina',roja:'sirena'};
  S.alertas=(p.alertas||[]).map(a=>({...a,fecha:loc(a.fecha)}));
  S.cfg={reminder:p.cfg.reminder,saverMin:+p.cfg.saverMin,kioskSec:+p.cfg.kioskSec,appMin:+p.cfg.appMin,topeHoras:+(p.cfg.topeHoras??14),membreteSup:p.cfg.membreteSup??40,membreteInf:p.cfg.membreteInf??20};
  S.loaded=true;
  alertCheck();
}
function applyPrivate(d){
  S.privRoster=true;
  S.roster=d.personas.map(x=>({id:x.id,n:x.n,cat:x.cat,g:x.g,cargo:x.cargo,activo:x.activo,sinPin:x.sinPin}));
  S.perms={};d.personas.forEach(x=>{if(x.perm)S.perms[x.n]=x.perm});
  S.guardias=d.guardias.map(x=>({id:x.id,ts:loc(x.ts),b:x.b,g:x.g,e:x.e,r:x.r,h:x.h,n:x.n}));
  S.horas=d.horas.map(x=>({id:x.id,b:x.b,m:x.m,d:x.d,i:loc(x.i),f:loc(x.f),manual:x.manual}));
  S.log=d.log.map(x=>({ts:loc(x.ts),by:x.by||'Sistema',txt:x.txt}));
  NS=null;
}
function clearPrivate(){legReset();S.tar=null;S.tarFin=null;S.tarHecha=null;S.tarA=null;S.tarFotos=null;S.tarDev=null;S.tarTab=null;S.tarG=null;S.tarU=null;S.tarQ=null;S.tarCL=null;S.tarCat=false;S.tarTipos=false;S.calD=null;S.calSel=null;S.alr=null;S.navis=null;S.sci=null;S.epp=null;S.sciSel=null;S.sciEdit=null;S.eppForm=null;S.eppCat=null;S.privRoster=false;S.guardias=[];S.horas=[];S.log=[];S.ficha=null;S.pmsg=null;NS=null}
async function loadPublic(){try{applyPublic(await rpc('publico'));}catch(e){S.netErr=e.message}}
async function reload(){
  await loadPublic();
  const tok=tokNow();
  if(tok){try{if(S.tab==='sci')S.sci=await rpc('sci_datos',{tok});else if(S.tab==='epp')S.epp=await rpc('epp_datos',{tok});else if(S.tab==='alertas')S.alr=await rpc('alertas_datos',{tok});else applyPrivate(await rpc('datos',{tok}));
    if((S.tab==='novedades'||S.tab==='guardia')&&S.news.some(x=>x.confirma))S.navis=await rpc('nov_asistentes',{tok})}catch(e){if(e.code==='SESION_VENCIDA'){toast('Tu sesión venció. Ingresá tu PIN de nuevo.');S.admin=null;logoutSess();return}}}
  else clearPrivate();
  render();
}
async function act(fn,args,okMsg){
  if(S.busy)return null;S.busy=true;
  try{const r=await call(fn,args);if(okMsg)toast(typeof okMsg==='function'?okMsg(r):okMsg);await reload();return (r==null||r==='')?true:r}
  catch(e){return null}
  finally{S.busy=false}
}

/* ---------- utilidades ---------- */
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dstr=d=>iso(d).slice(0,10);
const P=s=>new Date(s.length===10?s+'T00:00':s);
const hrs=r=>r.f?Math.max(0,(P(r.f)-P(r.i))/36e5):0;
function fmtH(h){if(!h)return '0:00';const t=Math.round(h*60);return `${Math.floor(t/60)}:${pad(t%60)}`}
const fmtD=s=>{const d=P(s);return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
const ddmm=s=>{const d=P(s);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`};
const mkey=s=>s.slice(0,7);
const addDays=(s,n)=>{const d=P(s);d.setDate(d.getDate()+n);return dstr(d)};
function split(n){const p=n.split(' ');const i=p.findIndex(w=>w!==w.toUpperCase());return i<0?[n,'']:[p.slice(0,i).join(' '),p.slice(i).join(' ')]}
// Selector de hora con dos listas (hora y minutos, 24 h). Funciona igual en todos los celulares,
// a diferencia del campo de hora del navegador, que en algunos Android no deja elegir.
function horaSel(id,val,opcional){
  const [h,m]=String(val||'').split(':'), mins=[...Array(12)].map((_,i)=>pad(i*5));
  if(m&&!mins.includes(m))mins.push(m),mins.sort();
  const op=(v,sel)=>`<option value="${v}" ${v===sel?'selected':''}>${v===''?'--':v}</option>`;
  return `<span class="hsel"><select id="${id}_h" aria-label="Hora">${opcional?op('',h||''):''}${[...Array(24)].map((_,i)=>op(pad(i),h)).join('')}</select><b>:</b><select id="${id}_m" aria-label="Minutos">${opcional?op('',m||''):''}${mins.map(x=>op(x,m)).join('')}</select><span class="hs-u">h</span></span>`;
}
// Total que se va a cargar, visible antes de guardar (para detectar una hora mal elegida).
function durTxt(min,cruza){
  if(min==null)return '';
  const t=`Total: <b class="mono">${Math.floor(min/60)}:${pad(min%60)} h</b>`;
  if(min<=0)return `<div class="durprev bad">La salida tiene que ser posterior a la entrada.</div>`;
  if(min>12*60)return `<div class="durprev bad">${t} · Más de 12 h: revisá los horarios.</div>`;
  return `<div class="durprev">${t}${cruza?' · termina al día siguiente':''}</div>`;
}
function durAct(){
  const a=horaVal('ai'),z=horaVal('af');if(!a||!z)return '';
  const m=t=>+t.slice(0,2)*60+ +t.slice(3);let d=m(z)-m(a),cruza=false;if(d<=0){d+=1440;cruza=true}
  return durTxt(d,cruza);
}
function durManual(){
  const i=$('#mi')?.value,f=$('#mf')?.value;if(!i||!f)return '';
  return durTxt(Math.round((P(f)-P(i))/60000),false);
}
function durCurso(a,z,d1,d2){
  if(!a||!z||!d1||!d2)return '';
  const m=t=>+t.slice(0,2)*60+ +t.slice(3);let d=m(z)-m(a);if(d<=0)d+=1440;
  const dias=Math.round((P(d2)-P(d1))/864e5)+1;
  if(dias<1)return `<div class="durprev bad">La fecha "hasta" tiene que ser igual o posterior a "desde".</div>`;
  if(d>16*60)return `<div class="durprev bad">Más de 16 h por día: revisá el horario.</div>`;
  const tot=d*dias;
  return `<div class="durprev">${dias} día${dias>1?'s':''} × ${Math.floor(d/60)}:${pad(d%60)} h = <b class="mono">${Math.floor(tot/60)}:${pad(tot%60)} h</b></div>`;
}
const durCursoAhora=()=>durCurso(horaVal('ci'),horaVal('cf'),$('#cd1')?.value,$('#cd2')?.value);
function horaVal(id){const h=document.getElementById(id+'_h'),m=document.getElementById(id+'_m');if(!h||!m||h.value===''||m.value==='')return '';return `${h.value}:${m.value}`}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=s=>document.querySelector(s);
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,3400)}
const member=n=>S.roster.find(r=>r.n===n);
const active=()=>S.roster.filter(p=>p.activo);
const sess=()=>S.sess[S.tab];
/* ---------- reglas de guardia ----------
   Cada guardia cubre de miércoles 20:00 a miércoles 19:59. La semana que arranca el miér 07/01/2026 20:00 es de la Guardia 1.
   Una "noche" se identifica por la fecha en que empieza (20 a 07 h). El registro vence a las 20:00 de esa fecha. */
const ROT0=new Date(2026,0,7,20,0);
const guardAt=t=>{const w=Math.floor((t-ROT0)/(7*864e5));return ((w%2)+2)%2===0?1:2};
const guardOfNight=n=>guardAt(new Date(P(n).getTime()+20*36e5));
function weekOf(t){const w=Math.floor((t-ROT0)/(7*864e5));const a=new Date(ROT0.getTime()+w*7*864e5);return [a,new Date(a.getTime()+7*864e5-60000)]}
// noche a la que corresponde un registro: antes de las 07 h pertenece a la noche anterior
function nightOf(ts){const d=P(ts);if(d.getHours()<7)d.setDate(d.getDate()-1);return dstr(d)}
// noche "en juego" para cargar ahora: de 07:00 a 06:59 del día siguiente
const currentNight=()=>nightOf(iso(new Date()));
const deadline=n=>new Date(P(n).getTime()+20*36e5);

let NS=null; // cache de estado por noche
function nightStatus(){
  if(NS)return NS;
  const own=new Map(), rep=new Map(), covered=new Set();
  const sorted=[...S.guardias].sort((a,b)=>a.ts.localeCompare(b.ts));
  for(const g of sorted){
    const n=nightOf(g.ts);
    own.set(g.b+'|'+n,{e:g.e,late:P(g.ts)>=deadline(n),r:g.r,n:g.n,ts:g.ts});
  }
  for(const [k,v] of own){
    if(v.e==='completa'||!v.r)continue;
    const [b,n]=k.split('|');
    // si dejó "reemplazo hasta el día" posterior, cubre también esas noches
    let last=n; const g=sorted.find(x=>x.b===b&&nightOf(x.ts)===n&&x.r===v.r&&x.h);
    if(g&&g.h>n)last=addDays(g.h,-1);
    for(let d=n;d<=last;d=addDays(d,1)){
      if(d!==n)covered.add(b+'|'+d);
      const rk=v.r+'|'+d; if(!rep.has(rk))rep.set(rk,{por:b,parcial:v.e==='parcial'});
    }
  }
  return NS={own,rep,covered};
}
function lastDueNight(){const now=new Date(),t=dstr(now);return now>=deadline(t)?t:addDays(t,-1)}
// estado de una persona en una noche
function statusOf(b,n){
  const ns=nightStatus(),o=ns.own.get(b+'|'+n),r=ns.rep.get(b+'|'+n),p=member(b);
  const onDuty=p&&p.activo&&p.g===guardOfNight(n);
  let st=null;
  if(o)st=o.e; else if(onDuty&&ns.covered.has(b+'|'+n))st='ausente';
  else if(onDuty&&n>=START_NIGHT&&n<=lastDueNight())st='sin';
  else if(onDuty&&n>lastDueNight())st='pend';
  return {st,late:!!(o&&o.late),rep:r||null,onDuty};
}
// resumen mensual por persona
function monthStats(b,mk){
  const p=member(b),ns=nightStatus();
  let comp=0,par=0,aus=0,sin=0,late=0,reps=0;
  const [y,m]=mk.split('-').map(Number), days=new Date(y,m,0).getDate();
  for(let d=1;d<=days;d++){
    const n=`${mk}-${pad(d)}`; const s=statusOf(b,n);
    if(s.st==='completa')comp++; else if(s.st==='parcial')par++; else if(s.st==='ausente')aus++; else if(s.st==='sin')sin++;
    if(s.late)late++; if(s.rep&&s.st!=='completa'&&s.st!=='parcial')reps++;
  }
  const h=S.horas.filter(x=>x.b===b&&x.f&&mkey(x.i)===mk);
  const hg=h.filter(x=>MOTIVOS_GUARDIA.includes(x.m)).reduce((s,x)=>s+hrs(x),0);
  const ha=h.filter(x=>!MOTIVOS_GUARDIA.includes(x.m)).reduce((s,x)=>s+hrs(x),0);
  return {n:b,g:p.g,comp,par,aus,sin,late,reps,total:comp+par+reps,hg,ha};
}
const openOf=b=>S.horas.find(r=>r.b===b&&!r.f&&!MOTIVOS_GUARDIA.includes(r.m));
const isInside=b=>S.adentro.some(x=>x.b===b);
function saveGuardia(rec){S.guardias.push(rec);NS=null}

/* ---------- barra de guardia ---------- */
function tick(){const d=new Date();$('#clk').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  $('#clkd').textContent=d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
function renderDuty(){
  const now=new Date(), g=guardAt(now), [a,b]=weekOf(now), n=currentNight(), gn=guardOfNight(n);
  const dentro=S.adentro.length;
  $('#duty').innerHTML=`<span class="label">En servicio</span><b>Guardia ${g}</b>
    <span class="pill">Miér ${ddmm(dstr(a))} 20:00 → miér ${ddmm(dstr(b))} 19:59</span>
    ${gn!==g?`<span class="pill yellow">Esta noche entra la Guardia ${gn}</span>`:''}
    <span class="pill green"><span class="dot"></span>${dentro} en el cuartel</span>
    ${S.netErr?`<span class="pill red">${esc(S.netErr)}</span>`:''}
    <button class="helpbtn" id="helpbtn" aria-label="Ayuda de esta pantalla" aria-pressed="${!!S.help}">?</button>`;
}

/* ---------- elegir persona + PIN (compartido) ---------- */
function groupsOf(list){
  return [['jef','Jefatura',p=>p.cargo],['1','Guardia 1',p=>!p.cargo&&p.g===1],['2','Guardia 2',p=>!p.cargo&&p.g===2],['0','Sin guardia asignada',p=>!p.cargo&&!p.g]]
    .map(([k,t,f])=>[k,t,list.filter(f).sort((a,b)=>(a.cargo==='Jefe'?-1:0)-(b.cargo==='Jefe'?-1:0)||a.n.localeCompare(b.n,'es'))]);
}
const catTag=p=>p.cargo?`<span class="tag red">${esc(p.cargo)}</span>`:p.cat==='Aspirante'?'<span class="tag">Aspirante</span>':'';
function vWho(title,lead,list,extra=''){
  const s=sess(), q=s.q.trim().toLowerCase();
  return `<h2>${title}</h2><p class="lead">${lead}</p>${extra}
  <input class="search" id="q" type="search" placeholder="Buscar por apellido" value="${esc(s.q)}" autocomplete="off">
  <div class="groups">${groupsOf(list.filter(p=>!q||p.n.toLowerCase().includes(q))).map(([k,t,ppl])=>{
    if(!ppl.length)return '';
    return `<section><span class="label">${t}</span><div class="names">${ppl.map(p=>{const [ln,fn]=split(p.n);
      const gr=gradoDe(p.n);
      return `<button class="name${gr?' hasins':''}" data-who="${esc(p.n)}">${gr?`<span class="nins">${insigniaSvg(gr.k,28)}<small>${esc(gr.a)}</small></span>`:''}<span class="ln">${esc(ln)}</span><span class="fn">${esc(fn)} ${catTag(p)}</span>${S.tab==='kiosco'&&isInside(p.n)?'<span class="in">● Adentro</span>':''}</button>`}).join('')}</div></section>`}).join('')}</div>`;
}
function vNewPin(){
  const s=sess(), forced=!!s.forced;
  return `<div class="pinbox"><span class="label">${forced?'Tu PIN fue reseteado':'Cambiar mi PIN'}</span><h2>${s.np1?'Repetí el PIN nuevo':'Elegí un PIN nuevo'}</h2>
  <p class="demo">${forced?'Por seguridad, elegí uno propio antes de seguir.':'4 números que no sean todos iguales ni seguidos.'}</p>
  <div class="pindots">${[0,1,2,3].map(i=>`<span class="${i<s.pin.length?'on':''}"></span>`).join('')}</div>
  <div class="err" id="pinerr"></div>
  <p class="demo kbhint">También podés usar el teclado: números, Borrar o Esc.</p>
  <div class="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join('')}
  <button class="ghost" data-k="x">Cancelar</button><button data-k="0">0</button><button class="ghost" data-k="b">Borrar</button></div></div>`;
}
const weakPin=p=>/^(\d)\1{3}$/.test(p)||'0123456789'.includes(p)||'9876543210'.includes(p);
function vPin(title,name){
  const s=sess();
  return `<div class="pinbox"><span class="label">${title}</span><h2>${esc(name)}</h2>
  <div class="pindots">${[0,1,2,3].map(i=>`<span class="${i<s.pin.length?'on':''}"></span>`).join('')}</div>
  <div class="err" id="pinerr"></div>
  <p class="demo kbhint">También podés usar el teclado: números, Borrar o Esc.</p>
  <div class="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join('')}
  <button class="ghost" data-k="x">Cancelar</button><button data-k="0">0</button><button class="ghost" data-k="b">Borrar</button></div></div>`;
}
const nice=b=>{const [ln,fn]=split(b);return `${fn} ${ln}`.trim()};

/* ---------- ASISTENCIA GENERAL (PC del cuartel) ---------- */
function vKioscoWho(){
  const strip=upcomingNews().slice(0,3);
  const extra=strip.length?`<div class="newsstrip">${strip.map(x=>`<div class="nstrip"><span class="tag ${x.tipo==='Evento'?'red':''}">${esc(x.tipo)}</span><b>${esc(x.titulo)}</b><span class="meta">${fmtNewsDate(x)}</span></div>`).join('')}</div>`:'';
  return sirButton()+vWho('Asistencia general','Tocá tu nombre al llegar y al irte del cuartel.',active(),extra)+`<p style="margin-top:24px"><button class="btn small outline" id="showsaver">Ver protector de pantalla</button> <span class="demo">Aparece solo a los ${S.cfg.saverMin} min sin uso.</span></p>`;
}
function vKiosco(){
  const s=sess();
  if(S.kmode==='sirena'){
    if(s.step==='who')return vWho('Sirena','Solo administradores, jefatura y superiores. Elegí tu nombre.',active().filter(p=>hasRole(p.n)))+'<p style="margin-top:18px"><button class="btn outline" id="closesiren">Volver a asistencia general</button></p>';
    if(s.step==='pin')return vPin('PIN para activar la sirena',nice(s.who));
    if(s.step==='newpin')return vNewPin();
    return vSirena(s.who);
  }
  if(s.step==='who')return vKioscoWho();
  if(s.step==='pin')return vPin('Ingresá tu PIN',nice(s.who));
  if(s.step==='newpin')return vNewPin();
  const b=s.who,[ln,fn]=split(b),o=openOf(b),mk=iso(new Date()).slice(0,7);
  const mine=S.horas.filter(r=>r.b===b&&!MOTIVOS_GUARDIA.includes(r.m)).sort((x,y)=>y.i.localeCompare(x.i));
  const monthH=mine.filter(r=>r.f&&mkey(r.i)===mk).reduce((t,r)=>t+hrs(r),0);
  let main;
  if(o){
    main=`<div class="card hot"><span class="pill green"><span class="dot"></span>Adentro</span>
      <h3 style="margin-top:10px">${esc(o.m)}</h3><p class="lead" style="margin:0 0 8px">${esc(o.d||'Sin descripción')}</p>
      <div class="since" id="since"></div><div class="demo">desde las ${fmtD(o.i).slice(6)}</div>
      <button class="btn go big" id="out">Registrar salida</button></div>`;
  } else if(S.mode==='in'){
    main=`<div class="card"><h3>Registrar entrada</h3><span class="label">Motivo</span>${chips(motivosActivos())}${canAsist(b)?'<button class="linkbtn" id="editmot">Editar actividades</button>':''}
      <div class="field"><label class="label" for="desc">Descripción (opcional)</label><input id="desc" placeholder="Ej.: lavado de unidades, reunión mensual"></div>
      <button class="btn primary big" id="doin" ${S.motivo?'':'disabled'}>Fichar entrada ahora</button>
      <button class="btn" style="margin-top:8px;width:100%" data-mode="">Volver</button></div>`;
  } else if(S.mode==='manual'){
    const n=new Date(),a=new Date(n.getTime()-2*36e5);
    main=`<div class="card"><h3>Cargar horas pasadas</h3><p class="lead">Para cuando no pudiste fichar. Queda marcada para que un encargado la revise.</p>
      <span class="label">Motivo</span>${chips(motivosActivos())}
      <div class="field"><label class="label" for="desc">Descripción</label><input id="desc" placeholder="Qué hiciste"></div>
      <div class="row"><div class="field"><label class="label" for="mi">Entrada</label><input id="mi" type="datetime-local" value="${iso(a)}"></div>
      <div class="field"><label class="label" for="mf">Salida</label><input id="mf" type="datetime-local" value="${iso(n)}" max="${iso(n)}"></div></div>
      <div id="durbox">${durTxt(120,false)}</div>
      <button class="btn primary big" id="domanual" ${S.motivo?'':'disabled'}>Guardar horas</button>
      <button class="btn" style="margin-top:8px;width:100%" data-mode="">Volver</button></div>`;
  } else if(S.mode==='curso'){
    const hoy=dstr(new Date());
    main=`<div class="card"><h3>Curso o actividad fuera del cuartel</h3><p class="lead">Para cursos o actividades de uno o varios días fuera del cuartel. Se carga cuando volvés: un registro por día, para que un encargado lo revise.</p>
      <span class="label">Actividad</span>${chips(motivosActivos())}
      <div class="field"><label class="label" for="desc">Qué y dónde</label><input id="desc" placeholder="Ej.: Curso de rescate vehicular, Córdoba"></div>
      <div class="row"><div class="field"><label class="label" for="cd1">Desde</label><input id="cd1" type="date" value="${hoy}" max="${hoy}"></div>
      <div class="field"><label class="label" for="cd2">Hasta</label><input id="cd2" type="date" value="${hoy}" max="${hoy}"></div></div>
      <div class="row"><div class="field"><label class="label" for="ci_h">Horario de cada día · desde</label>${horaSel('ci','09:00')}</div>
      <div class="field"><label class="label" for="cf_h">hasta</label>${horaSel('cf','18:00')}</div></div>
      <div id="durbox">${durCurso('09:00','18:00',hoy,hoy)}</div>
      <p class="demo" style="margin:8px 0 0">Si algún día tuvo otro horario, cargá ese día aparte con "Cargar horas pasadas".</p>
      <button class="btn primary big" id="docurso" ${S.motivo?'':'disabled'}>Guardar días</button>
      <button class="btn" style="margin-top:8px;width:100%" data-mode="">Volver</button></div>`;
  } else {
    main=`<div class="card"><h3>¿Qué querés hacer?</h3><div class="choices">
      <button class="choice" data-mode="in"><span class="ic r">→</span><span><strong>Registrar entrada</strong><small>Reunión, mantenimiento, capacitación, evento…</small></span></button>
      <button class="choice" data-mode="manual"><span class="ic y">+</span><span><strong>Cargar horas pasadas</strong><small>Si te olvidaste de fichar</small></span></button>
      <button class="choice" data-mode="curso"><span class="ic k">C</span><span><strong>Curso o actividad fuera del cuartel</strong><small>Uno o varios días, se carga al volver</small></span></button>
    </div><p class="demo" style="margin:12px 0 0">La guardia, la capacitación y el mantenimiento de guardia se cargan desde la app de Guardia.</p></div>`;
  }
  return `<div class="who"><div><span class="label">Asistencia general</span><h2>Hola, ${esc(fn||ln)}</h2></div><span class="row" style="gap:6px"><button class="btn outline small" id="chpin">Cambiar PIN</button><button class="btn outline" id="bye">Terminar</button></span></div>
  ${S.motOpen&&canAsist(b)?vMotEditor():''}<div class="grid2">${main}
    <div class="card"><h3>Tu mes de ${MESES[new Date().getMonth()].toLowerCase()}</h3>
      <div class="stats"><div class="stat"><div class="n">${fmtH(monthH)}</div><div class="k">horas de asistencia general</div></div></div>
      <div class="section-h" style="margin:16px 0 4px"><span class="label">Últimos registros</span></div>
      <ul class="list">${mine.slice(0,6).map(r=>`<li><span>${esc(r.m)}${r.manual?' <span class="pill yellow">a revisar</span>':''}</span><span class="meta mono">${ddmm(r.i)} · ${r.f?fmtH(hrs(r))+' h':'en curso'}</span></li>`).join('')||'<li class="empty">Sin registros todavía</li>'}</ul>
    </div></div>`;
}
function chips(list){return `<div class="chips" style="margin-top:6px">${list.map(m=>`<button class="chip" data-mot="${esc(m)}" aria-pressed="${S.motivo===m}">${esc(m)}</button>`).join('')}</div>`}

/* ---------- GUARDIA (celular) ---------- */
function vGuardia(){
  const s=sess(); let inner;
  if(s.step==='who')inner=vWho('App de guardia','Elegí tu nombre. En el celular queda recordado y entrás con tu PIN.',active());
  else if(s.step==='pin')inner=vPin('Ingresá tu PIN',nice(s.who))+'<p style="text-align:center"><button class="linkbtn" id="notyo">No soy yo</button></p>';
  else if(s.step==='newpin')inner=vNewPin();
  else inner=vGuardiaMe();
  return `<div class="phone">${inner}</div>`;
}
function remindAt(n){const [h,m]=S.cfg.reminder.split(':').map(Number);const d=P(n);d.setHours(h,m,0,0);return d}
const nightLegend=()=>`<div class="nlegend"><span><i class="night ok"></i>Completa</span><span><i class="night par"></i>Parcial</span><span><i class="night aus"></i>No va (reemplazo)</span><span><i class="night cub"></i>Cubre a otro</span><span><i class="night miss"></i>Sin registro</span></div>`;
function vGuardiaMe(){
  const b=sess().who,[ln,fn]=split(b),p=member(b),now=new Date();
  const hasG=p.g===1||p.g===2;
  const n=currentNight(), gn=guardOfNight(n), mine=hasG&&p.g===gn;
  const st=statusOf(b,n), dl=deadline(n), left=dl-now;
  if(S.mode==='panel'&&hasRole(b))return vPanel(b,true);
  if(S.mode==='calif')return vMiCalif(b);
  if(S.mode==='legajo')return vMiLegajo(b);
  if(S.mode==='tareas')return vMisTareas(b);
  if(S.mode==='news')return `<div class="who"><div><span class="label">Novedades</span><h2>Novedades</h2></div><button class="btn outline small" data-mode="">Volver</button></div>${vNews(b,true)}`;
  let nightsArr=[];
  if(hasG){let wStart=n;
    if(mine){while(P(wStart).getDay()!==3)wStart=addDays(wStart,-1)}
    else{wStart=addDays(n,1);while(!(P(wStart).getDay()===3&&guardOfNight(wStart)===p.g))wStart=addDays(wStart,1)}
    nightsArr=[...Array(7)].map((_,i)=>addDays(wStart,i));}
  let card;
  if(S.mode==='guard'&&mine){
    const otraG=3-p.g, others=active().filter(r=>r.g===otraG&&!r.cargo);
    card=`<div class="card"><h3>Guardia de esta noche</h3><p class="lead" style="margin-bottom:8px">${DIAS[P(n).getDay()]} ${ddmm(n)} · 20 a 07 h. Si no podés, dejá reemplazo.</p>
      <div class="chips">${[['completa','Completa'],['parcial','Parcial'],['ausente','No puedo ir']].map(([k,t])=>`<button class="chip" data-est="${k}" aria-pressed="${S.est===k}">${t}</button>`).join('')}</div>
      ${S.est&&S.est!=='completa'?`<div class="field"><label class="label" for="rep">Reemplazo de la Guardia ${otraG} ${S.est==='ausente'?'(obligatorio)':'por las horas que faltás'}</label>
        <select id="rep"><option value="">Elegir…</option>${others.map(r=>`<option>${esc(r.n)}</option>`).join('')}</select></div>
        <div class="field"><label class="label" for="gnote">Horario</label><input id="gnote" placeholder="${S.est==='parcial'?'Ej.: 20:00 a 01:00':'Ej.: guardia completa'}"></div>`:''}
      <button class="btn primary big" id="doguard" ${S.est?'':'disabled'}>Confirmar</button>
      <button class="btn" style="margin-top:8px;width:100%" data-mode="">Volver</button></div>`;
  } else if((S.mode==='cap'||S.mode==='mant')&&hasG){
    const isCap=S.mode==='cap';
    // por defecto: la última hora (termina ahora, redondeado a 5 min)
    const fz=new Date(now);fz.setMinutes(Math.floor(fz.getMinutes()/5)*5,0,0);const fa=new Date(fz.getTime()-36e5);
    const actFin=`${pad(fz.getHours())}:${pad(fz.getMinutes())}`,actIni=`${pad(fa.getHours())}:${pad(fa.getMinutes())}`;
    card=`<div class="card"><h3>${isCap?'Capacitación de guardia':'Mantenimiento / limpieza'}</h3>
      <div class="field"><label class="label" for="ad">Fecha</label><input id="ad" type="date" value="${dstr(new Date(now.getTime()-36e5))}" max="${dstr(now)}"></div>
      <div class="row"><div class="field"><label class="label" for="ai_h">Inicio</label>${horaSel('ai',actIni)}</div>
      <div class="field"><label class="label" for="af_h">Fin</label>${horaSel('af',actFin)}</div></div>
      <div id="durbox">${durTxt(60,false)}</div>
      <div class="field"><label class="label" for="at">${isCap?'Temática':'Tareas realizadas'}</label><input id="at" placeholder="${isCap?'Ej.: incendio vehicular':'Ej.: limpieza de unidades'}" value="${!isCap&&S.actPrefill?esc(S.actPrefill):''}"></div>
      <button class="btn primary big" id="doact" data-act="${S.mode}">Guardar</button>
      <button class="btn" style="margin-top:8px;width:100%" data-mode="">Volver</button></div>`;
  } else {
    let gcard='', bell='';
    if(mine){
      const done=st.st&&st.st!=='pend'&&st.st!=='sin';
      const lab={completa:'Completa',parcial:'Parcial',ausente:'No asiste'}[st.st];
      if(!done&&now>=remindAt(n)&&left>0)bell=`<div class="notif-inline"><span class="notif-ic" aria-hidden="true">!</span><span><b>Recordatorio de las ${S.cfg.reminder}</b><br>Todavía no registraste tu guardia de esta noche. Tenés tiempo hasta las 20:00.</span></div>`;
      const pc={completa:'green',parcial:'yellow',ausente:'red'}[st.st], cc={completa:'hot',parcial:'alert',ausente:'redb'}[st.st];
      gcard=`<div class="card ${done?cc:'alert'}"><div class="top"><h3>Guardia de esta noche</h3>${done?`<span class="pill ${pc}">${lab}${st.late?' · fuera de hora':''}</span>`:`<span class="pill red">Sin registrar</span>`}</div>
        <div class="demo">${DIAS[P(n).getDay()]} ${ddmm(n)} · Guardia ${gn} · 20 a 07 h</div>
        ${!done?(left>0?`<div class="deadline">Cargá antes de las 20:00 <span class="mono" id="cd">${fmtH(left/36e5)}</span></div>`:`<div class="deadline">Pasaron las 20:00 · se registra fuera de hora</div>`):''}
        <button class="btn ${done?'outline':'primary'} big" data-mode="guard">${done?'Cambiar respuesta':'Registrar guardia'}</button></div>`;
    } else if(hasG){
      gcard=`<div class="card off"><div class="top"><h3>Guardia de esta noche</h3><span class="pill">Pasiva</span></div>
        <p style="margin:0">Esta noche está la Guardia ${gn}. Tu próxima guardia empieza el <b>miércoles ${ddmm(nightsArr[0])} a las 20:00</b>. Ese día ya vas a poder cargar desde la mañana.</p></div>`;
    } else {
      gcard=`<div class="card off"><h3>${p.cargo?esc(p.cargo):'Sin guardia asignada'}</h3><p style="margin:0">${p.cargo?'La jefatura no integra ninguna guardia.':'No tenés una guardia asignada.'} Si te dejan como reemplazo, la noche te cuenta igual.</p></div>`;
    }
    const cover=st.rep?`<div class="card alert"><h3>Esta noche cubrís</h3><p style="margin:0">${esc(nice(st.rep.por))} te dejó como reemplazo${st.rep.parcial?' por unas horas':''}. Te cuenta como guardia.</p></div>`:'';
    const r=roleOf(b);
    const sup=r?`<button class="choice" data-mode="panel" style="background:var(--ink);color:#fff;border-color:var(--ink)"><span class="ic y">P</span><span><strong>Panel de ${r==='admin'?'administración':r==='jefatura'?'jefatura':'superiores'}</strong><small style="color:#ddd">Quién confirmó esta noche, resúmenes y fichas</small></span></button>`:'';
    const up=upcomingNews().length;
    const nov=`<button class="choice" data-mode="news"><span class="ic r">N</span><span><strong>Novedades</strong><small>${up?`${up} próxima${up>1?'s':''}: cursos, charlas, eventos`:'Cursos, charlas, eventos'}${r?' · podés publicar':''}</small></span></button>`;
    const avisos=pushOn()?'':`<div class="card alert"><h3>Avisos en este celular</h3><p style="margin:0 0 6px">Activalos para recibir el recordatorio de las ${S.cfg.reminder} y las novedades nuevas.</p>${isIOS&&!isStandalone()?'<p class="demo" style="margin:0 0 6px">En iPhone: primero tocá <b>Compartir → Agregar a inicio</b> y abrí la app desde ese ícono.</p>':''}<button class="btn primary big" id="pushon">Activar avisos</button></div>`;
    const calb=`<button class="choice" data-mode="calif"><span class="ic g">%</span><span><strong>Mi calificación</strong><small>Tu porcentaje de asistencia del año y qué mejorar</small></span></button>`;
    const tarb=`<button class="choice" data-mode="tareas"><span class="ic r">T</span><span><strong>Mis tareas</strong><small>Las que te asignaron y las que podés pedir</small></span></button>`;
    const legb=`<button class="choice" data-mode="legajo"><span class="ic k">L</span><span><strong>Mi legajo</strong><small>Jerarquía, nivel, antigüedad, cursos y tus datos</small></span></button>`;
    card=`${avisos}${bell}${sup}${cover}${gcard}${tarb}${nov}${calb}${legb}
      ${hasG?`<div class="card"><h3>Otras actividades de guardia</h3><div class="choices">
        <button class="choice" data-mode="cap"><span class="ic k">C</span><span><strong>Capacitación</strong><small>Hora de inicio, fin y temática</small></span></button>
        <button class="choice" data-mode="mant"><span class="ic y">M</span><span><strong>Mantenimiento / limpieza</strong><small>Hora de inicio, fin y tareas</small></span></button>
      </div></div>`:''}`;
  }
  const mk=iso(now).slice(0,7), ms=monthStats(b,mk);
  const tag=p.cargo?esc(p.cargo):hasG?`Guardia ${p.g}`:'Sin guardia';
  return `<div class="who"><div><span class="label">${tag} · ${esc(p.cat)}</span><h2>Hola, ${esc(fn||ln)}</h2></div><span class="row" style="gap:6px"><button class="btn outline small" id="chpin">Cambiar PIN</button><button class="btn outline small" id="bye">Salir</button></span></div>
  <div class="grid2">${card}
    ${hasG?`<div class="card"><h3>${mine?'Tu semana de guardia':'Tu próxima semana'}</h3>
      <div class="nights">${nightsArr.map(d=>{const x=statusOf(b,d);const c={completa:'ok',parcial:'par',ausente:'aus',sin:'miss'}[x.st]||(x.rep?'cub':'');
        const t={completa:'✓',parcial:'Parcial',ausente:'No va',sin:'Sin reg.'}[x.st]||(x.rep?'Cubre':'—');
        return `<div class="night ${c} ${d===n?'today':''}"><b>${DIAS[P(d).getDay()]}</b>${ddmm(d)}<br>${t}</div>`}).join('')}</div>
      ${nightLegend()}
      <div class="stats" style="margin-top:14px"><div class="stat"><div class="n">${ms.total}</div><div class="k">guardias en ${MESES[now.getMonth()].toLowerCase()}</div></div>
      <div class="stat"><div class="n">${ms.reps}</div><div class="k">como reemplazo</div></div>
      <div class="stat"><div class="n">${fmtH(ms.hg)}</div><div class="k">h cap. y mant.</div></div></div>
    </div>`:''}</div>`;
}

/* ---------- PANEL ---------- */
function months(){const set=new Set([...S.horas.map(r=>mkey(r.i)),...S.guardias.map(g=>mkey(g.ts))]);return [...set].sort()}
const roleOf=v=>{const p=member(v);if(!p||!p.activo)return null;const x=S.perms[v];if(x==='admin')return 'admin';if(p.cargo)return 'jefatura';if(x==='sup')return p.g===1?'sup1':p.g===2?'sup2':'sup0';return null};
const hasRole=v=>!!roleOf(v);
const canAsist=v=>['admin','jefatura'].includes(roleOf(v));
const scopeOf=v=>{const r=roleOf(v);return r==='sup1'?1:r==='sup2'?2:'all'};
function roleLabel(v){const r=roleOf(v),p=member(v);return r==='jefatura'?p.cargo:{admin:'Administrador',sup1:'Superior Guardia 1',sup2:'Superior Guardia 2',sup0:'Superior sin guardia'}[r]||''}
function gfFor(v){const sc=scopeOf(v);return sc==='all'?S.gfilter:String(sc)}
function rowsFor(mk,v){const gf=gfFor(v);const r=active().map(p=>monthStats(p.n,mk));return gf==='all'?r:r.filter(x=>String(x.g)===gf)}
function vPanelTab(){
  const s=sess();
  if(!S.admin){
    if(s.step==='newpin')return vNewPin();
    if(s.step==='pin')return vPin('Ingresá tu PIN',nice(s.who));
    return vWho('Panel','Para administradores, jefatura y superiores. Cada uno entra con su propio PIN.',active().filter(p=>hasRole(p.n)));
  }
  return vPanel(S.admin,false);
}
function agStats(b,mk){
  const rs=S.horas.filter(x=>x.b===b&&x.f&&!MOTIVOS_GUARDIA.includes(x.m)&&mkey(x.i)===mk);
  const by={};for(const r of rs)by[r.m]=(by[r.m]||0)+hrs(r);
  return {n:b,g:member(b).g,tot:rs.reduce((s,r)=>s+hrs(r),0),by,cnt:rs.length,rs};
}
function guardHours(b,mk,m){return S.horas.filter(x=>x.b===b&&x.f&&x.m===m&&mkey(x.i)===mk).reduce((s,x)=>s+hrs(x),0)}
const people=v=>{const gf=gfFor(v);return active().filter(p=>gf==='all'||String(p.g)===gf)};
function vPanel(viewer,compact){
  const ms=months();if(!S.month)S.month=ms[ms.length-1];
  const scope=scopeOf(viewer),[y,m]=S.month.split('-'),gf=gfFor(viewer);
  const tabsP=[['guardia','Guardia'],...(canAsist(viewer)?[['asist','Asistencia general']]:[]),...(canAsist(viewer)?[['informes','Resúmenes'],['calif','Calificación']]:[]),['tareas','Tareas'],['legajos','Legajos'],...(roleOf(viewer)==='admin'?[['personal','Personal']]:[])];
  if(!tabsP.some(([k])=>k===S.ptab))S.ptab='guardia';
  const ptab=S.ptab;
  const gfOpts=scope==='all'?[['all','Todos'],['1','Guardia 1'],['2','Guardia 2'],['0','Sin guardia y jefatura']]:[[String(scope),'Guardia '+scope]];
  const semana=ptab==='guardia'&&S.gper==='semana';
  const ws=semana?weekStarts(scope):[];
  if(semana&&ws.length&&!ws.some(w=>w.start===S.week))S.week=ws[0].start;
  const head=`<div class="who"><div><span class="label">${esc(nice(viewer))} · ${roleLabel(viewer)}</span><h2>${semana?'Semana de guardia':{tareas:'Tareas',legajos:'Legajos',calif:'Calificación',personal:'Personal'}[ptab]||`${MESES[+m-1]} ${y}`}</h2></div>${compact?'<button class="btn outline small" data-mode="">Volver</button>':'<button class="btn outline" id="logout">Salir del panel</button>'}</div>
  ${tabsP.length>1?`<div class="seg" role="tablist">${tabsP.map(([k,l])=>`<button data-ptab="${k}" aria-selected="${ptab===k}">${l}</button>`).join('')}</div>`:''}
  ${ptab==='guardia'?`<div class="seg seg2" role="tablist"><button data-gper="mes" aria-selected="${!semana}">Por mes</button><button data-gper="semana" aria-selected="${semana}">Por semana</button></div>`:''}
  ${semana?`<div class="filters"><div class="field" style="flex:1 1 320px"><label class="label" for="fw">Semana</label><select id="fw">${ws.map(w=>`<option value="${w.start}" ${w.start===S.week?'selected':''}>${esc(weekLabel(w))}</option>`).join('')}</select></div></div>`:''}
  <div class="filters">
    <div class="field"><label class="label" for="fm">Mes</label><select id="fm">${ms.map(k=>`<option value="${k}" ${k===S.month?'selected':''}>${MESES[+k.slice(5)-1]} ${k.slice(0,4)}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="fg">Personal</label><select id="fg" ${gfOpts.length===1?'disabled':''}>${gfOpts.map(([v,t])=>`<option value="${v}" ${gf===v?'selected':''}>${t}</option>`).join('')}</select></div>
    ${compact?'':'<button class="btn small outline" id="csv">Copiar tabla para Sheets</button>'}
    ${ptab==='guardia'?'<button class="btn small primary" id="pdfmonth">PDF mensual para firmar</button>':''}
  </div>`;
  if(semana)return head.slice(0,head.lastIndexOf('<div class="filters">'))+vPanelSemana(viewer,compact);
  if(ptab==='personal')return head.slice(0,head.indexOf('<div class="filters">'))+vPersonal(viewer);
  if(ptab==='informes')return head.slice(0,head.indexOf('<div class="filters">'))+vInformes(viewer,compact);
  if(ptab==='calif')return head.slice(0,head.indexOf('<div class="filters">'))+vCalifPanel(viewer);
  if(ptab==='legajos')return head.slice(0,head.indexOf('<div class="filters">'))+vLegajosPanel(viewer);
  if(ptab==='tareas')return head.slice(0,head.indexOf('<div class="filters">'))+vTareasPanel(viewer);
  return head+(ptab==='asist'?vPanelAsist(viewer,compact):vPanelGuardia(viewer,compact));
}
/* ---------- semanas de guardia (miércoles 20:00 a miércoles 19:59) ---------- */
function weekStarts(scope){
  const out=[];let d=START_NIGHT;
  while(P(d).getDay()!==3)d=addDays(d,-1);
  const cur=currentNight();
  for(;d<=cur;d=addDays(d,7)){const g=guardOfNight(d);if(scope==='all'||scope===g)out.push({start:d,g})}
  return out.reverse();
}
const weekLabel=w=>`Guardia ${w.g} · Mié ${ddmm(w.start)} 20:00 → Mié ${ddmm(addDays(w.start,7))} 19:59`;
const ST_CLS={completa:'ok',parcial:'par',ausente:'aus',sin:'miss'};
const ST_TXT={completa:'Completa',parcial:'Parcial',ausente:'No va',sin:'Sin reg.',pend:'Pendiente'};
function weekData(w){
  const nights=[...Array(7)].map((_,i)=>addDays(w.start,i));
  const ns=nightStatus();
  const inRecords=n=>S.guardias.some(x=>x.b===n&&nights.includes(nightOf(x.ts)));
  const crew=S.roster.filter(p=>p.g===w.g&&!p.cargo&&(p.activo||inRecords(p.n))).sort((a,b)=>a.n.localeCompare(b.n,'es'));
  const crewSet=new Set(crew.map(p=>p.n));
  const reps=[];
  for(const n of nights)for(const [k,v] of ns.rep){const [b,nn]=k.split('|');if(nn===n)reps.push({n,b,por:v.por,parcial:v.parcial,horario:ns.own.get(v.por+'|'+n)?.n||''})}
  const helpers=[...new Set(reps.map(r=>r.b).filter(b=>!crewSet.has(b)))].sort((a,b)=>a.localeCompare(b,'es'));
  const mk=(name,helper)=>{
    const cells=nights.map(n=>{const s=statusOf(name,n);let c=ST_CLS[s.st]||'',t=ST_TXT[s.st]||'—';
      if(!s.st&&s.rep){c='cub';t='Cubre'} if(s.st==='pend'&&n>currentNight()){c='';t=''} if(helper&&!s.rep){c='';t=''} return {n,st:s.st,rep:s.rep,late:s.late,c,t}});
    const cnt=k=>cells.filter(x=>x.st===k).length;
    const cub=cells.filter(x=>x.rep&&x.st!=='completa'&&x.st!=='parcial').length;
    return {n:name,helper,cells,comp:cnt('completa'),par:cnt('parcial'),aus:cnt('ausente'),sin:cnt('sin'),late:cells.filter(x=>x.late).length,cub,total:cnt('completa')+cnt('parcial')+cub};
  };
  const rows=[...crew.map(p=>mk(p.n,false)),...helpers.map(b=>mk(b,true))];
  const a=new Date(P(w.start).getTime()+20*36e5),z=new Date(a.getTime()+7*864e5);
  const names=new Set(rows.map(r=>r.n));
  const acts=S.horas.filter(h=>h.f&&MOTIVOS_GUARDIA.includes(h.m)&&names.has(h.b)&&P(h.i)>=a&&P(h.i)<z).sort((x,y)=>x.i.localeCompare(y.i));
  const sum=k=>rows.reduce((s,r)=>s+r[k],0);
  return {w,nights,rows,reps,acts,tot:{total:sum('total'),comp:sum('comp'),par:sum('par'),aus:sum('aus'),sin:sum('sin'),late:sum('late'),cub:sum('cub'),
    cap:acts.filter(h=>h.m===CAP).reduce((s,h)=>s+hrs(h),0),mant:acts.filter(h=>h.m===MANT).reduce((s,h)=>s+hrs(h),0)}};
}
function vPanelSemana(viewer,compact){
  const ws=weekStarts(scopeOf(viewer));
  if(!ws.length)return '<p class="empty">Todavía no hay semanas de guardia.</p>';
  if(!S.week||!ws.some(w=>w.start===S.week))S.week=ws[0].start;
  const W=weekData(ws.find(w=>w.start===S.week)),T=W.tot;
  const cell=x=>`<td class="wk"><span class="night ${x.c}">${x.t}${x.late?'*':''}</span></td>`;
  return `<div class="kpis">
    <div class="kpi"><div class="n">${T.total}</div><div class="k">guardias cumplidas (${T.cub} como reemplazo)</div></div>
    <div class="kpi"><div class="n">${T.par}</div><div class="k">parciales</div></div>
    <div class="kpi"><div class="n">${T.aus}</div><div class="k">ausencias con reemplazo</div></div>
    <div class="kpi warn"><div class="n">${T.sin}</div><div class="k">noches sin registro · ${T.late} fuera de hora</div></div>
    <div class="kpi"><div class="n">${fmtH(T.cap+T.mant)}</div><div class="k">h capacitación y mantenimiento</div></div>
  </div>
  <div class="section-h"><h3 style="margin:0">${esc(weekLabel(W.w))}</h3><button class="btn primary" id="pdfweek">PDF para firmar</button></div>
  <div class="tablewrap"><table class="wktable"><thead><tr><th>Integrante</th>${W.nights.map(n=>`<th class="c">${DIAS[P(n).getDay()]}<br>${ddmm(n)}</th>`).join('')}<th class="num">Total</th></tr></thead>
  <tbody>${W.rows.map(r=>`<tr${r.helper?' class="helper"':''}><td>${esc(r.n)}${r.helper?` <span class="tag">Guardia ${3-W.w.g}</span>`:''}</td>${r.cells.map(cell).join('')}<td class="num"><b>${r.total}</b></td></tr>`).join('')}</tbody></table></div>
  ${nightLegend()}<p class="demo" style="margin:4px 0 0">* registrado después de las 20:00.</p>
  <div class="grid2" style="margin-top:16px">
    <div class="card"><h3>Reemplazos</h3><ul class="list">${W.reps.map(r=>`<li><span>${esc(r.por)} → <b>${esc(r.b)}</b><br><span class="meta">${r.parcial?'Parcial':'Total'}${r.horario?' · '+esc(r.horario):''}</span></span><span class="meta mono">${DIAS[P(r.n).getDay()]} ${ddmm(r.n)}</span></li>`).join('')||'<li class="empty">Sin reemplazos esta semana.</li>'}</ul></div>
    <div class="card"><h3>Capacitación y mantenimiento</h3><ul class="list">${W.acts.map(h=>`<li><span>${esc(h.b)}<br><span class="meta">${h.m===CAP?'Capacitación':'Mantenimiento'}${h.d?' · '+esc(h.d):''}</span></span><span class="meta mono">${fmtD(h.i)} · ${fmtH(hrs(h))} h</span></li>`).join('')||'<li class="empty">Sin actividades cargadas esta semana.</li>'}</ul></div>
  </div>`;
}
function vPanelGuardia(viewer,compact){
  const scope=scopeOf(viewer);
  const rows=rowsFor(S.month,viewer).map(r=>({...r,cap:guardHours(r.n,S.month,CAP),mant:guardHours(r.n,S.month,MANT)}));
  const T=rows.reduce((a,r)=>{for(const k of ['comp','par','aus','sin','late','reps','total','cap','mant'])a[k]=(a[k]||0)+r[k];return a},{});
  const n=currentNight(), gn=guardOfNight(n), crew=active().filter(p=>p.g===gn&&!p.cargo), dl=deadline(n), now=new Date();
  const cover=[...nightStatus().rep].filter(([k])=>k.endsWith('|'+n)).map(([k,v])=>({b:k.split('|')[0],...v}));
  const nextWed=scope==='all'?null:(()=>{let d=addDays(n,1);while(!(P(d).getDay()===3&&guardOfNight(d)===scope))d=addDays(d,1);return d})();
  const tonight=scope!=='all'&&scope!==gn?`<div class="card off"><div class="top"><h3>Esta noche · Guardia ${gn}</h3><span class="pill">Tu guardia está pasiva</span></div><p style="margin:0">La Guardia ${scope} vuelve el <b>miércoles ${ddmm(nextWed)} a las 20:00</b>. Desde esa mañana vas a ver acá quién confirmó.</p></div>`
   :`<div class="card"><div class="top"><h3>Esta noche · Guardia ${gn}</h3><span class="pill ${now<dl?'yellow':'red'}">${now<dl?'Cierra 20:00':'Pasadas las 20:00'}</span></div>
    <ul class="list">${crew.map(p=>{const s=statusOf(p.n,n);
      const pill=s.st==='completa'?'<span class="pill green">Completa</span>':s.st==='parcial'?'<span class="pill yellow">Parcial</span>':s.st==='ausente'?'<span class="pill red">No asiste</span>':s.st==='sin'?'<span class="pill dark">Sin registro</span>':'<span class="pill redsoft">Pendiente</span>';
      const o=nightStatus().own.get(p.n+'|'+n);
      return `<li><span>${esc(p.n)}${o&&o.r&&o.e!=='completa'?`<br><span class="meta">reemplazo: ${esc(o.r)}</span>`:''}</span><span>${pill}${s.late?' <span class="pill redsoft">fuera de hora</span>':''}</span></li>`}).join('')}
    ${cover.filter(c=>member(c.b)?.g!==gn).map(c=>`<li><span>${esc(c.b)}<br><span class="meta">cubre a ${esc(c.por)}</span></span><span class="pill green">Reemplazo</span></li>`).join('')}</ul>
    <p class="demo" style="margin:10px 0 0">${now>=remindAt(n)?`Recordatorio enviado a las ${S.cfg.reminder} a quienes no habían registrado.`:`A las ${S.cfg.reminder} se envía un recordatorio a quienes no registraron.`}</p></div>`;
  const cards=`<div class="pcards">${rows.map(r=>`<button class="pcard ${S.ficha===r.n?'sel':''}" data-ficha="${esc(r.n)}"><span class="pc-name">${esc(r.n)}</span>
      <span class="pc-stats"><span><b class="mono">${r.total}</b> guardias${r.reps?` · ${r.reps} reemp.`:''}</span><span><b class="mono">${fmtH(r.cap+r.mant)}</b> h cap./mant.</span></span>
      ${r.sin||r.late?`<span class="pc-warn">${r.sin?`<span class="pill red">${r.sin} sin registro</span>`:''}${r.late?`<span class="pill yellow">${r.late} fuera de hora</span>`:''}</span>`:''}</button>`).join('')}</div>`;
  const cell=(v,c='')=>`<td class="num ${v?c:'zero'}">${v}</td>`, cellH=v=>`<td class="num ${v?'':'zero'}">${fmtH(v)}</td>`;
  return `<div class="grid2" style="margin-bottom:8px">${tonight}</div>
  <div class="kpis">
    <div class="kpi"><div class="n">${T.total}</div><div class="k">guardias cumplidas (${T.reps} como reemplazo)</div></div>
    <div class="kpi warn"><div class="n">${T.sin}</div><div class="k">noches sin registro</div></div>
    <div class="kpi warn"><div class="n">${T.late}</div><div class="k">registros fuera de hora</div></div>
    <div class="kpi"><div class="n">${fmtH(T.cap)}</div><div class="k">h de capacitación de guardia</div></div>
    <div class="kpi"><div class="n">${fmtH(T.mant)}</div><div class="k">h de mantenimiento / limpieza</div></div>
  </div>
  <div class="section-h"><h3 style="margin:0">Guardia por bombero</h3><span class="demo">Tocá a una persona para ver su ficha anual</span></div>
  ${cards}
  <div class="tablewrap sumtable"><table><thead><tr><th>Bombero / Aspirante</th><th>Gdia.</th><th class="num">Guardias</th><th class="num">Propias</th><th class="num">Reemplazos</th><th class="num">Parciales</th><th class="num">Ausencias</th><th class="num">Sin registro</th><th class="num">Fuera de hora</th><th class="num">H. capacitación</th><th class="num">H. mant./limp.</th></tr></thead>
  <tbody>${rows.map(r=>`<tr class="click ${S.ficha===r.n?'sel':''}" data-ficha="${esc(r.n)}"><td>${esc(r.n)}</td><td>${r.g||'—'}</td><td class="num"><b>${r.total}</b></td>${cell(r.comp+r.par)}${cell(r.reps)}${cell(r.par)}${cell(r.aus)}${cell(r.sin,'warn')}${cell(r.late,'warn')}${cellH(r.cap)}${cellH(r.mant)}</tr>`).join('')}
  <tr class="tot"><td>Total</td><td></td><td class="num">${T.total}</td><td class="num">${T.comp+T.par}</td><td class="num">${T.reps}</td><td class="num">${T.par}</td><td class="num">${T.aus}</td><td class="num">${T.sin}</td><td class="num">${T.late}</td><td class="num">${fmtH(T.cap)}</td><td class="num">${fmtH(T.mant)}</td></tr></tbody></table></div>
  <div id="ficha">${S.ficha?vFichaGuardia(S.ficha):''}</div>`;
}
function vPanelAsist(viewer,compact){
  const ppl=people(viewer), rows=ppl.map(p=>agStats(p.n,S.month));
  const mots=motivosTodos().filter(mo=>rows.some(r=>r.by[mo]));
  const byMot=mots.map(mo=>({mo,h:rows.reduce((s,r)=>s+(r.by[mo]||0),0),p:rows.filter(r=>r.by[mo]).length})).sort((a,b)=>b.h-a.h);
  const tot=rows.reduce((s,r)=>s+r.tot,0), act=rows.filter(r=>r.tot).length, cnt=rows.reduce((s,r)=>s+r.cnt,0);
  const names=new Set(ppl.map(p=>p.n));
  const open=S.horas.filter(r=>!r.f&&names.has(r.b)), rev=S.horas.filter(r=>r.manual&&names.has(r.b));
  const ro=compact?'<p class="demo" style="margin:10px 0 0">Las acciones se hacen desde la PC del cuartel.</p>':'';
  const max=byMot.length?byMot[0].h:1;
  return `${S.motOpen?vMotEditor():`<div class="row" style="margin:-4px 0 14px"><button class="btn small outline" id="editmot">Editar actividades</button></div>`}<div class="kpis">
    <div class="kpi"><div class="n">${fmtH(tot)}</div><div class="k">horas de asistencia general</div></div>
    <div class="kpi"><div class="n">${act}</div><div class="k">bomberos con horas cargadas</div></div>
    <div class="kpi"><div class="n">${cnt}</div><div class="k">registros en el mes</div></div>
  </div>
  <div class="grid2" style="margin-bottom:8px">
    <div class="card"><h3>Horas por actividad</h3>${byMot.length?`<div class="bars">${byMot.map(x=>`<div class="barrow"><span class="bl">${esc(x.mo)}</span><span class="bt"><span class="bf" style="width:${Math.max(2,x.h/max*100)}%"></span></span><span class="bv mono">${fmtH(x.h)}</span><span class="bp">${x.p} pers.</span></div>`).join('')}</div>`:'<p class="empty">Sin horas cargadas este mes.</p>'}</div>
    <div class="card"><h3>En el cuartel ahora</h3>${open.length?`<ul class="list">${open.map(r=>`<li><span>${esc(r.b)}<br><span class="meta">${esc(r.m)} · desde ${fmtD(r.i).slice(6)}</span></span>${compact?'':`<button class="btn small" data-close="${r.id}">Cerrar</button>`}</li>`).join('')}</ul>`:'<p class="empty">Nadie fichado en este momento.</p>'}${open.length?ro:''}</div>
    ${rev.length?`<div class="card"><h3>Cargas manuales a revisar</h3><ul class="list">${rev.map(r=>`<li><span>${esc(r.b)}<br><span class="meta">${esc(r.m)} · ${fmtD(r.i)} → ${fmtD(r.f).slice(6)} · ${fmtH(hrs(r))} h</span></span>${compact?'<span class="pill yellow">A revisar</span>':`<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn small go" data-ok="${r.id}">Aprobar</button><button class="btn small" data-del="${r.id}">Borrar</button></span>`}</li>`).join('')}</ul>${ro}</div>`:''}
  </div>
  <div class="section-h"><h3 style="margin:0">Horas por bombero y actividad</h3><span class="demo">Tocá a una persona para ver el detalle</span></div>
  <div class="pcards">${rows.filter(r=>r.tot).sort((a,b)=>b.tot-a.tot).map(r=>`<button class="pcard ${S.ficha===r.n?'sel':''}" data-ficha="${esc(r.n)}"><span class="pc-name">${esc(r.n)}</span>
     <span class="pc-stats"><span>${Object.keys(r.by).length} ${Object.keys(r.by).length===1?'actividad':'actividades'}</span><span><b class="mono">${fmtH(r.tot)}</b> h</span></span>
     <span class="pc-mots">${Object.entries(r.by).sort((a,b)=>b[1]-a[1]).map(([mo,h])=>`<span>${esc(mo)} <b class="mono">${fmtH(h)}</b></span>`).join('')}</span></button>`).join('')||'<p class="empty">Sin horas cargadas este mes.</p>'}</div>
  <div class="tablewrap sumtable"><table><thead><tr><th>Bombero / Aspirante</th>${mots.map(mo=>`<th class="num">${esc(mo)}</th>`).join('')}<th class="num">Total</th></tr></thead>
  <tbody>${rows.map(r=>`<tr class="click ${S.ficha===r.n?'sel':''}" data-ficha="${esc(r.n)}"><td>${esc(r.n)}</td>${mots.map(mo=>`<td class="num ${r.by[mo]?'':'zero'}">${fmtH(r.by[mo]||0)}</td>`).join('')}<td class="num"><b>${fmtH(r.tot)}</b></td></tr>`).join('')}
  <tr class="tot"><td>Total</td>${mots.map(mo=>`<td class="num">${fmtH(rows.reduce((s,r)=>s+(r.by[mo]||0),0))}</td>`).join('')}<td class="num">${fmtH(tot)}</td></tr></tbody></table></div>
  <div id="ficha">${S.ficha?vFichaAsist(S.ficha):''}</div>`;
}
/* ---------- editor de actividades de asistencia general (administradores y jefatura) ---------- */
function vMotEditor(){
  if(!S.motEdit)S.motEdit=motivosCfg().map(m=>({o:m.n,n:m.n,activo:m.activo!==false}));
  const uso=n=>n?S.horas.filter(r=>r.m===n).length:0;
  return `<div class="card alert" style="margin-bottom:16px"><div class="top"><h3>Actividades de asistencia general</h3><button class="btn small outline" id="editmot">Cerrar</button></div>
  <p class="demo" style="margin:0 0 8px">Si renombrás una actividad, las horas ya cargadas pasan al nombre nuevo. Las que ya tienen horas no se quitan: desactivalas y dejan de aparecer al fichar, pero siguen en los informes.</p>
  <ul class="list motlist">${S.motEdit.map((m,i)=>{const u=uso(m.o);return `<li><input class="tpin" data-mt="${i}" value="${esc(m.n)}" placeholder="Nombre de la actividad" aria-label="Nombre de la actividad">
    <label class="check" style="margin:0"><input type="checkbox" data-ma="${i}" ${m.activo?'checked':''}> Activa</label><span class="meta">${m.o?u+' reg.':'nueva'}</span>
    <span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn small" data-mup="${i}" ${i?'':'disabled'} aria-label="Subir">↑</button><button class="btn small" data-mdel="${i}" ${u?'disabled title="Tiene horas cargadas: desactivala"':''}>Quitar</button></span></li>`}).join('')}</ul>
  <div class="row" style="margin-top:12px"><button class="btn outline" id="addmot">Agregar actividad</button><button class="btn primary" id="savemot">Guardar actividades</button></div></div>`;
}
function motCollect(){
  document.querySelectorAll('[data-mt]').forEach(el=>{const m=S.motEdit[+el.dataset.mt];if(m)m.n=el.value});
  document.querySelectorAll('[data-ma]').forEach(el=>{const m=S.motEdit[+el.dataset.ma];if(m)m.activo=el.checked});
}
async function motAction(t){
  const d=t.dataset;
  if(t.id==='editmot'){S.motOpen=!S.motOpen;S.motEdit=null;render();return true}
  if(!S.motEdit)return false;
  if(t.id==='addmot'){motCollect();S.motEdit.push({o:null,n:'',activo:true});render();const l=document.querySelectorAll('[data-mt]');l[l.length-1]?.focus();return true}
  if(d.mup!==undefined){motCollect();const i=+d.mup;[S.motEdit[i-1],S.motEdit[i]]=[S.motEdit[i],S.motEdit[i-1]];render();return true}
  if(d.mdel!==undefined){motCollect();S.motEdit.splice(+d.mdel,1);render();return true}
  if(t.id==='savemot'){motCollect();
    const L=S.motEdit.map(m=>({...m,n:m.n.trim().replace(/\s+/g,' ')}));
    if(L.some(m=>m.n.length<2)){toast('Ninguna actividad puede quedar sin nombre.');return true}
    if(new Set(L.map(m=>m.n.toLowerCase())).size!==L.length){toast('Hay dos actividades con el mismo nombre.');return true}
    if(!L.some(m=>m.activo)){toast('Tiene que quedar al menos una actividad activa.');return true}
    const cambios=L.filter(m=>m.o&&m.o!==m.n).map(m=>({viejo:m.o,nuevo:m.n}));
    if(await act('guardar_motivos',{cambios,lista:L.map(m=>({n:m.n,activo:m.activo}))},'Actividades guardadas.')){S.motOpen=false;S.motEdit=null;render()}
    return true}
  return false;
}
function monthsBetween(a,b){return months().filter(k=>k>=a&&k<=b)}
const r2=x=>Math.round(x*100)/100;
function personPeriod(b,ks){
  const per=ks.map(k=>{const s=monthStats(b,k);return {k,...s,cap:guardHours(b,k,CAP),mant:guardHours(b,k,MANT),ag:agStats(b,k)}});
  const sum=f=>per.reduce((t,x)=>t+f(x),0);
  const asign=sum(x=>x.comp+x.par+x.aus+x.sin);
  return {per,tot:{total:sum(x=>x.total),propias:sum(x=>x.comp+x.par),reps:sum(x=>x.reps),par:sum(x=>x.par),aus:sum(x=>x.aus),sin:sum(x=>x.sin),late:sum(x=>x.late),cap:sum(x=>x.cap),mant:sum(x=>x.mant),ag:sum(x=>x.ag.tot),asign},
    cumpl:asign?sum(x=>x.comp+x.par)/asign:null, reg:asign?(asign-sum(x=>x.sin))/asign:null};
}
const pct=v=>v==null?'—':Math.round(v*100)+'%';
const mesL=k=>MESES[+k.slice(5)-1]+' '+k.slice(0,4);
function vInformes(viewer,compact){
  const ms=months();
  if(!S.rep)S.rep={b:'',from:ms[0],to:ms[ms.length-1]};
  const R=S.rep, ks=monthsBetween(R.from,R.to), ppl=active();
  let prev='';
  if(R.from>R.to)prev='<p class="err">El mes "desde" tiene que ser anterior o igual al mes "hasta".</p>';
  else if(R.b){
    const P_=personPeriod(R.b,ks),T=P_.tot;
    prev=`<div class="kpis">
      <div class="kpi"><div class="n">${T.total}</div><div class="k">guardias cumplidas (${T.reps} como reemplazo)</div></div>
      <div class="kpi"><div class="n">${pct(P_.cumpl)}</div><div class="k">cumplimiento de sus noches de guardia</div></div>
      <div class="kpi warn"><div class="n">${T.sin}</div><div class="k">noches sin registro · ${T.late} fuera de hora</div></div>
      <div class="kpi"><div class="n">${fmtH(T.cap+T.mant)}</div><div class="k">h capacitación y mant. de guardia</div></div>
      <div class="kpi"><div class="n">${fmtH(T.ag)}</div><div class="k">h asistencia general</div></div></div>
    <div class="tablewrap"><table><thead><tr><th>Mes</th><th class="num">Guardias</th><th class="num">Reemp.</th><th class="num">Ausencias</th><th class="num">Sin reg.</th><th class="num">Fuera hora</th><th class="num">H. cap.</th><th class="num">H. mant.</th><th class="num">H. asist. gral.</th></tr></thead><tbody>
    ${P_.per.map(x=>`<tr><td>${mesL(x.k)}</td><td class="num">${x.total}</td><td class="num ${x.reps?'':'zero'}">${x.reps}</td><td class="num ${x.aus?'':'zero'}">${x.aus}</td><td class="num ${x.sin?'warn':'zero'}">${x.sin}</td><td class="num ${x.late?'warn':'zero'}">${x.late}</td><td class="num">${fmtH(x.cap)}</td><td class="num">${fmtH(x.mant)}</td><td class="num">${fmtH(x.ag.tot)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="num">${T.total}</td><td class="num">${T.reps}</td><td class="num">${T.aus}</td><td class="num">${T.sin}</td><td class="num">${T.late}</td><td class="num">${fmtH(T.cap)}</td><td class="num">${fmtH(T.mant)}</td><td class="num">${fmtH(T.ag)}</td></tr></tbody></table></div>`;
  } else {
    prev=`<p class="lead" style="margin-top:12px">Con "Todos" el Excel trae una fila por bombero con los totales del período, más el detalle de cada uno.</p>`;
  }
  return `<p class="lead">Elegí a quién y qué meses. El Excel incluye guardia y asistencia general por separado, con el detalle de cada registro.</p>
  <div class="card" style="margin-bottom:16px">
    <div class="row">
      <div class="field" style="flex:2 1 220px"><label class="label" for="rb">Bombero / Aspirante</label><select id="rb"><option value="">Todos</option>${ppl.map(p=>`<option ${R.b===p.n?'selected':''}>${esc(p.n)}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="rf">Desde</label><select id="rf">${ms.map(k=>`<option value="${k}" ${k===R.from?'selected':''}>${mesL(k)}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="rt">Hasta</label><select id="rt">${ms.map(k=>`<option value="${k}" ${k===R.to?'selected':''}>${mesL(k)}</option>`).join('')}</select></div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn primary" style="flex:1 1 220px;padding:16px" id="pdfofi" ${R.from>R.to?'disabled':''}>PDF oficial para firmar</button><button class="btn outline" style="flex:1 1 220px;padding:16px" id="dlx" ${R.from>R.to||!DL?'disabled':''}>Descargar Excel</button></div>
    <p class="demo" style="margin:8px 0 0">El PDF lleva gráficos y espacio de firma para Jefe y Sub Jefe, y deja libre el margen de la hoja membretada.</p>
  </div>${prev}`;
}
function guardLog(b,ks){
  const out=[];const ns=nightStatus();
  for(const k of ks){const [y,m]=k.split('-').map(Number);const days=new Date(y,m,0).getDate();
    for(let d=1;d<=days;d++){const n=`${k}-${pad(d)}`;const s=statusOf(b,n);if(!s.st&&!s.rep)continue;if(s.st==='pend')continue;
      const o=ns.own.get(b+'|'+n);
      out.push({Noche:n.split('-').reverse().join('/'),Guardia:guardOfNight(n),
        Estado:s.st?{completa:'Completa',parcial:'Parcial',ausente:'No asiste',sin:'Sin registro'}[s.st]:'—',
        'Cubrió a':s.rep?s.rep.por:'','Su reemplazo':o&&o.e!=='completa'?(o.r||''):'',Horario:o?.n||'',
        'Registrado':o?fmtD(o.ts):'','Fuera de hora':s.late?'Sí':''});}}
  return out;
}
function buildBook(viewer){
  const R=S.rep, ks=monthsBetween(R.from,R.to), wb=XLSX.utils.book_new();
  const head=[['Asoc. Bomberos Voluntarios de Isla Verde'],['Período',`${mesL(R.from)} a ${mesL(R.to)}`],['Generado por',nice(viewer)+' · '+new Date().toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})],[]];
  const add=(name,aoa,widths)=>{const ws=XLSX.utils.aoa_to_sheet(aoa);if(widths)ws['!cols']=widths.map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31))};
  const ppl=R.b?[member(R.b)]:active();
  const GH=['Guardias cumplidas','Propias','Como reemplazo','Parciales','Ausencias con reemplazo','Sin registro','Fuera de hora','Noches asignadas','% cumplimiento','% registro','H. capacitación guardia','H. mant./limpieza guardia'];
  if(!R.b){
    const rows=ppl.map(p=>{const x=personPeriod(p.n,ks),T=x.tot;return [p.n,p.g,T.total,T.propias,T.reps,T.par,T.aus,T.sin,T.late,T.asign,x.cumpl==null?'':r2(x.cumpl),x.reg==null?'':r2(x.reg),r2(T.cap),r2(T.mant),r2(T.ag)]});
    add('Resumen general',[...head,['Bombero / Aspirante','Guardia',...GH,'H. asistencia general'],...rows],[28,8,...GH.map(()=>12),14]);
    const mots=motivosTodos().filter(mo=>ppl.some(p=>ks.some(k=>agStats(p.n,k).by[mo])));
    add('Asistencia por actividad',[...head,['Bombero / Aspirante',...mots,'Total'],...ppl.map(p=>{const by={};let t=0;for(const k of ks){const a=agStats(p.n,k);t+=a.tot;for(const[mo,h]of Object.entries(a.by))by[mo]=(by[mo]||0)+h}return [p.n,...mots.map(mo=>r2(by[mo]||0)),r2(t)]})],[28,...mots.map(()=>14),10]);
  }
  for(const p of ppl){
    const x=personPeriod(p.n,ks);
    const pre=R.b?'':p.n.split(' ')[0]+' ';
    if(R.b){
      const mrows=x.per.map(r=>[mesL(r.k),r.total,r.comp+r.par,r.reps,r.par,r.aus,r.sin,r.late,r.comp+r.par+r.aus+r.sin,r2(r.cap),r2(r.mant),r2(r.ag.tot)]);
      const T=x.tot;
      add('Resumen',[['Bombero / Aspirante',p.n],['Guardia',p.g||'—'],...head.slice(1),
        ['Mes','Guardias cumplidas','Propias','Como reemplazo','Parciales','Ausencias con reemplazo','Sin registro','Fuera de hora','Noches asignadas','H. capacitación guardia','H. mant./limpieza guardia','H. asistencia general'],...mrows,
        ['Total',T.total,T.propias,T.reps,T.par,T.aus,T.sin,T.late,T.asign,r2(T.cap),r2(T.mant),r2(T.ag)],
        ['Promedio mensual',...[T.total,T.propias,T.reps,T.par,T.aus,T.sin,T.late,T.asign,T.cap,T.mant,T.ag].map(v=>r2(v/Math.max(1,ks.length)))],[],
        ['% cumplimiento de guardia',x.cumpl==null?'—':r2(x.cumpl)],['% de noches registradas',x.reg==null?'—':r2(x.reg)]],[26,12,10,12,10,14,12,12,12,14,14,14]);
      const mots=motivosTodos().filter(mo=>x.per.some(r=>r.ag.by[mo]));
      add('Asistencia por actividad',[['Bombero / Aspirante',p.n],[],['Actividad',...ks.map(mesL),'Total'],...mots.map(mo=>[mo,...x.per.map(r=>r2(r.ag.by[mo]||0)),r2(x.per.reduce((s,r)=>s+(r.ag.by[mo]||0),0))]),['Total',...x.per.map(r=>r2(r.ag.tot)),r2(x.tot.ag)]],[26,...ks.map(()=>14),10]);
    }
    const gl=guardLog(p.n,ks).map(r=>R.b?r:{Bombero:p.n,...r});
    const al=S.horas.filter(r=>r.b===p.n&&r.f&&ks.includes(mkey(r.i))).sort((a,c)=>a.i.localeCompare(c.i));
    const glRows=gl.length?gl:[{Noche:'Sin registros'}];
    const alRows=al.map(r=>({...(R.b?{}:{Bombero:p.n}),Tipo:MOTIVOS_GUARDIA.includes(r.m)?'Guardia':'Asistencia general',Actividad:r.m.replace('Guardia · ',''),Descripción:r.d||'',Entrada:fmtD(r.i),Salida:fmtD(r.f),Horas:r2(hrs(r)),'Carga manual':r.manual?'Sí, a revisar':''}));
    if(R.b){
      const w1=XLSX.utils.json_to_sheet(glRows);w1['!cols']=[12,9,13,26,26,22,14,12].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,w1,'Registros de guardia');
      const w2=XLSX.utils.json_to_sheet(alRows.length?alRows:[{Tipo:'Sin registros'}]);w2['!cols']=[18,26,40,13,13,8,14].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,w2,'Registros de horas');
    } else {(buildBook.g=buildBook.g||[]).push(...gl);(buildBook.a=buildBook.a||[]).push(...alRows)}
  }
  if(!R.b){
    const w1=XLSX.utils.json_to_sheet(buildBook.g.length?buildBook.g:[{Bombero:'Sin registros'}]);w1['!cols']=[26,12,9,13,26,26,22,14,12].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,w1,'Registros de guardia');
    const w2=XLSX.utils.json_to_sheet(buildBook.a.length?buildBook.a:[{Bombero:'Sin registros'}]);w2['!cols']=[26,18,26,40,13,13,8,14].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,w2,'Registros de horas');
    buildBook.g=[];buildBook.a=[];
  }
  return wb;
}
async function downloadReport(viewer){
  if(!canAsist(viewer))return;
  const R=S.rep;
  if(typeof XLSX==='undefined'){toast('No se pudo cargar el generador de Excel. Revisá la conexión.');return}
  const who=R.b?R.b.replace(/\s+/g,'_'):'Todos';
  XLSX.writeFile(buildBook(viewer),`Resumen_${who}_${R.from}_a_${R.to}.xlsx`);
  toast('Excel descargado.');
}

/* ---------- PERSONAL (solo administradores) ---------- */
const UBIC=[['1','Guardia 1'],['2','Guardia 2'],['0','Sin guardia'],['Jefe','Jefatura · Jefe'],['Sub Jefe','Jefatura · Sub Jefe']];
const PERMS=[['','Ninguno'],['sup','Superior'],['admin','Administrador']];
const ubicOf=p=>p.cargo||String(p.g);
const ubicLabel=p=>p.cargo?'Jefatura · '+p.cargo:p.g?'Guardia '+p.g:'Sin guardia';
const opts=(list,sel)=>list.map(([v,t])=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${t}</option>`).join('');
function vPersonal(viewer){
  const act=active(), bajas=S.roster.filter(p=>!p.activo);
  const permTag=n=>S.perms[n]==='admin'?'<span class="tag red">Administrador</span>':S.perms[n]==='sup'?'<span class="tag yellow">Superior</span>':'';
  const row=p=>{
    if(S.editP===p.n)return `<li class="pedit"><b>${esc(p.n)}</b>
      <div class="row"><div class="field"><label class="label" for="ep_cat">Categoría</label><select id="ep_cat">${opts([['Bombero','Bombero'],['Aspirante','Aspirante']],p.cat)}</select></div>
      <div class="field"><label class="label" for="ep_ubic">Ubicación</label><select id="ep_ubic">${opts(UBIC,ubicOf(p))}</select></div>
      <div class="field"><label class="label" for="ep_perm">Permiso</label><select id="ep_perm">${opts(PERMS,S.perms[p.n]||'')}</select></div>
      <div class="field"><label class="label" for="ep_jer">Jerarquía</label><select id="ep_jer">${gradoOptions((S.jer||{})[p.n]||'')}</select></div></div>
      <div class="row" style="margin-top:10px"><button class="btn primary small" data-saveedit="${esc(p.n)}">Guardar cambios</button><button class="btn small" id="canceledit">Cancelar</button></div></li>`;
    const confirm=S.confirmBaja===p.n;
    return `<li><span><b>${esc(p.n)}</b>${p.n===viewer?' <span class="meta">(vos)</span>':''}<br><span class="tags"><span class="tag">${esc(p.cat)}</span><span class="tag">${ubicLabel(p)}</span>${gradoDe(p.n)?`<span class="tag ins">${insigniaSvg(gradoDe(p.n).k,16)} ${esc(gradoDe(p.n).n)}</span>`:''}${permTag(p.n)}${p.sinPin?'<span class="tag yellow">Sin PIN propio</span>':''}</span></span>
      <span class="pbtns">${confirm?`<button class="btn small primary" data-baja="${esc(p.n)}">Confirmar baja</button><button class="btn small" id="canceledit">No</button>`
      :`<button class="btn small outline" data-editp="${esc(p.n)}">Editar</button><button class="btn small outline" data-resetpin="${esc(p.n)}">Resetear PIN</button><button class="btn small" data-askbaja="${esc(p.n)}">Dar de baja</button>`}</span></li>`;
  };
  return `<p class="lead">Solo los administradores ven esta sección. Las bajas no borran el historial: la persona deja de aparecer en las listas y sus registros quedan.</p>
  ${S.pmsg?`<div class="card alert" style="margin-bottom:14px"><div class="top"><h3>Atención</h3><button class="btn small outline" id="clearmsg">Listo</button></div><p style="margin:0;font-size:18px">${S.pmsg}</p></div>`:''}
  <div class="grid2" style="margin-bottom:16px">
  <div class="card"><h3>Agregar persona</h3>
    <div class="field"><label class="label" for="np_name">Apellido y nombre</label><input id="np_name" placeholder="Ej.: PÉREZ Juan" autocomplete="off"></div>
    <div class="row"><div class="field"><label class="label" for="np_cat">Categoría</label><select id="np_cat">${opts([['Aspirante','Aspirante'],['Bombero','Bombero']],'Aspirante')}</select></div>
    <div class="field"><label class="label" for="np_ubic">Ubicación</label><select id="np_ubic">${opts(UBIC,'0')}</select></div>
    <div class="field"><label class="label" for="np_perm">Permiso</label><select id="np_perm">${opts(PERMS,'')}</select></div></div>
    <button class="btn primary big" id="addp">Dar de alta</button>
    <p class="demo" style="margin:8px 0 0">Se genera un PIN inicial que la persona cambia en su primer ingreso.</p></div>
  <div class="card"><h3>Configuración</h3>
    <div class="row"><div class="field"><label class="label" for="cf_rem_h">Recordatorio de guardia</label>${horaSel('cf_rem',S.cfg.reminder)}</div>
    <div class="field"><label class="label" for="cf_saver">Protector de pantalla PC (min)</label><input id="cf_saver" type="number" min="1" max="60" value="${S.cfg.saverMin}"></div></div>
    <div class="row"><div class="field"><label class="label" for="cf_kiosk">Cierre de sesión PC (seg)</label><input id="cf_kiosk" type="number" min="15" max="600" value="${S.cfg.kioskSec}"></div>
    <div class="field"><label class="label" for="cf_app">Cierre de sesión celular y panel (min)</label><input id="cf_app" type="number" min="1" max="60" value="${S.cfg.appMin}"></div></div>
    <div class="row"><div class="field"><label class="label" for="cf_tope">Tope por fichaje de asistencia (h)</label><input id="cf_tope" type="number" min="4" max="24" value="${S.cfg.topeHoras||14}"><span class="hint">Si alguien no ficha la salida, la entrada se cierra sola en ese tiempo y queda "a revisar".</span></div></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="savecfg">Guardar</button><button class="btn outline" id="testnotif">Probar notificación</button></div></div>
  <div class="card"><h3>Hoja membretada</h3>
    <p style="margin:0 0 8px">Espacio que los PDF dejan en blanco arriba y abajo para imprimir sobre las hojas con membrete.</p>
    <div class="row"><div class="field"><label class="label" for="cf_msup">Margen superior (mm)</label><input id="cf_msup" type="number" min="0" max="120" value="${S.cfg.membreteSup}"></div>
    <div class="field"><label class="label" for="cf_minf">Margen inferior (mm)</label><input id="cf_minf" type="number" min="0" max="80" value="${S.cfg.membreteInf}"></div></div>
    <button class="btn primary" style="margin-top:12px" id="savememb">Guardar márgenes</button></div>
  <div class="card"><h3>PC del cuartel</h3>
    <p style="margin:0 0 8px">La asistencia general solo se puede registrar desde las computadoras habilitadas.${isKiosk()?' <b>Esta computadora está habilitada.</b>':''}</p>
    ${isKiosk()?'<div class="row"><button class="btn outline" id="unsetkiosk">Deshabilitar esta computadora</button><button class="btn" id="killkiosks">Deshabilitar todas</button></div>'
      :'<div class="field"><label class="label" for="kname">Nombre</label><input id="kname" value="PC de la entrada"></div><button class="btn primary big" id="setkiosk">Habilitar esta computadora</button>'}</div>
  <div class="card"><h3>PIN del personal</h3>
    <p style="margin:0 0 8px">Para la puesta en marcha: genera un PIN inicial para todos los que todavía no tienen. Cada uno lo cambia en su primer ingreso.</p>
    <button class="btn outline big" id="genpins">Generar PIN pendientes</button></div>
  </div>
  <div class="section-h"><h3 style="margin:0">Personal activo · ${act.length}</h3><span class="demo">Jefe y Sub Jefe: uno por cargo. Si asignás uno nuevo, el anterior pasa a "Sin guardia".</span></div>
  ${groupsOf(act).map(([k,t,ppl])=>ppl.length?`<div class="card" style="margin-bottom:12px"><h3>${t} <span class="meta">· ${ppl.length}</span></h3><ul class="list plist">${ppl.map(row).join('')}</ul></div>`:'').join('')}
  ${bajas.length?`<div class="section-h"><h3 style="margin:0">Dados de baja · ${bajas.length}</h3></div><div class="card"><ul class="list">${bajas.map(p=>`<li><span>${esc(p.n)}<br><span class="meta">${esc(p.cat)} · ${ubicLabel(p)}</span></span><button class="btn small outline" data-reactivar="${esc(p.n)}">Reactivar</button></li>`).join('')}</ul></div>`:''}
  <div class="section-h"><h3 style="margin:0">Historial de cambios</h3></div>
  <div class="card"><ul class="list">${S.log.slice().reverse().map(l=>`<li><span>${esc(l.txt)}</span><span class="meta mono">${fmtD(l.ts)} · ${esc(l.by)}</span></li>`).join('')||'<li class="empty">Sin cambios todavía. Acá queda quién cambió qué y cuándo.</li>'}</ul></div>`;
}
const adminsLeft=()=>active().filter(p=>S.perms[p.n]==='admin').length;
async function personalAction(t,viewer){
  if(roleOf(viewer)!=='admin')return false;
  const d=t.dataset;
  if(t.id==='addp'){
    const n=$('#np_name').value.trim().replace(/\s+/g,' ');
    if(n.length<4){toast('Escribí apellido y nombre.');return true}
    const r=await act('alta_persona',{nombre:n,cat:$('#np_cat').value,ubic:$('#np_ubic').value,permiso:$('#np_perm').value||null});
    if(r){S.pmsg=`Alta de <b>${esc(r.nombre)}</b>. PIN inicial: <b class="mono">${r.pin}</b>. Pasáselo en persona; al entrar se le pide que lo cambie.`;render()}
    return true}
  if(d.editp){S.editP=d.editp;S.confirmBaja=null;render();return true}
  if(t.id==='canceledit'){S.editP=null;S.confirmBaja=null;render();return true}
  if(t.id==='clearmsg'){S.pmsg=null;render();return true}
  if(d.saveedit){const p=member(d.saveedit),jer=$('#ep_jer').value;
    if(jer!==((S.jer||{})[p.n]||'')&&!await act('asignar_jerarquia',{pid:p.id,jerarquia:jer||null}))return true;
    if(await act('editar_persona',{pid:p.id,cat:$('#ep_cat').value,ubic:$('#ep_ubic').value,permiso:$('#ep_perm').value||null},'Cambios guardados.')){
      S.editP=null;if(p.n===viewer&&!hasRole(viewer)){S.admin=null;logoutSess();return true}render()}
    return true}
  if(d.resetpin){const p=member(d.resetpin);const pin=await act('resetear_pin',{pid:p.id});
    if(pin){S.pmsg=`PIN temporal de <b>${esc(p.n)}</b>: <b class="mono">${pin}</b>. Al entrar se le pide elegir uno nuevo.`;render()}return true}
  if(t.id==='genpins'){const r=await act('generar_pines_pendientes',{});
    if(r){S.pmsg=r.length?`PIN iniciales generados (anotalos ahora, no se vuelven a mostrar):<table class="pintable"><tbody>${r.map(x=>`<tr><td>${esc(x.nombre)}</td><td class="mono"><b>${x.pin}</b></td></tr>`).join('')}</tbody></table>`:'Todos tienen PIN.';render()}return true}
  if(d.askbaja){if(S.perms[d.askbaja]==='admin'&&adminsLeft()<=1){toast('No podés dar de baja al único administrador.');return true}S.confirmBaja=d.askbaja;S.editP=null;render();return true}
  if(d.baja){const p=member(d.baja);if(await act('cambiar_estado',{pid:p.id,activar:false},`${p.n} dado de baja. Su historial se conserva.`)){S.confirmBaja=null;if(p.n===viewer){S.admin=null;logoutSess();return true}render()}return true}
  if(d.reactivar){const p=member(d.reactivar);await act('cambiar_estado',{pid:p.id,activar:true},`${p.n} reactivado.`);return true}
  if(t.id==='savecfg'){const r=horaVal('cf_rem'),sv=+$('#cf_saver').value,k=+$('#cf_kiosk').value,a=+$('#cf_app').value;
    const tp=+$('#cf_tope').value;if(!(tp>=4&&tp<=24)){toast('El tope va de 4 a 24 horas.');return true}
    if(tp!==+(S.cfg.topeHoras||14)&&!await act('guardar_tope',{horas:tp}))return true;
    await act('guardar_config',{recordatorio:r,protector:sv,cierre_pc:k,cierre_app:a},'Configuración guardada.');return true}
  if(t.id==='savememb'){await act('guardar_membrete',{sup:+$('#cf_msup').value,inf:+$('#cf_minf').value},'Márgenes guardados. Se aplican a los próximos PDF.');return true}
  if(t.id==='testnotif'){await act('notificacion_prueba',{},'Notificación de prueba enviada a tus celulares con avisos activados.');return true}
  if(t.id==='setkiosk'){const nom=$('#kname').value;const clave=await act('registrar_kiosco',{nombre:nom});
    if(clave){LS.set('bviv_kiosco',clave);toast('Esta computadora quedó habilitada como PC del cuartel.');S.admin=null;logoutSess();S.tab='kiosco';render()}return true}
  if(t.id==='unsetkiosk'){LS.set('bviv_kiosco',null);toast('Esta computadora ya no es la PC del cuartel.');render();return true}
  if(t.id==='killkiosks'){await act('quitar_kioscos',{},'Se deshabilitaron todas las PC del cuartel. Volvé a habilitar la que corresponda.');LS.set('bviv_kiosco',null);render();return true}
  return false;
}

/* ---------- NOVEDADES ---------- */
// Vigente: si tiene "vigente hasta", hasta esa fecha y hora; si no, hasta el final del día de su fecha (sin fecha: hasta que se archive).
function vigente(x){if(x.hasta)return P(x.hasta)>new Date();return !x.fecha||x.fecha>=dstr(new Date())}
function upcomingNews(){return S.news.filter(vigente).sort((a,b)=>(a.fecha||'9999').localeCompare(b.fecha||'9999'))}
const fmtHasta=x=>{if(!x.hasta)return '';const d=P(x.hasta);return `${DIAS[d.getDay()]} ${ddmm(x.hasta)} ${x.hasta.slice(11,16)} h`};
function fmtNewsDate(x){if(!x.fecha)return 'Sin fecha';const d=P(x.fecha);return `${DIAS[d.getDay()]} ${ddmm(x.fecha)}${x.hora?' · '+x.hora+' h':''}`}
function newsCard(x,viewer){
  const canDel=viewer&&(roleOf(viewer)==='admin'||x.autor===viewer);
  const canArch=viewer&&vigente(x)&&(['admin','jefatura'].includes(roleOf(viewer))||x.autor===viewer);
  return `<article class="ncard"><div class="top"><span class="tag ${x.tipo==='Evento'?'red':x.tipo==='Curso'||x.tipo==='Capacitación'||x.tipo==='Mantenimiento'?'yellow':''}">${esc(x.tipo)}</span><span class="mono ndate">${fmtNewsDate(x)}</span></div>
    <h3>${esc(x.titulo)}</h3>${x.hasta?`<p class="nhasta">${vigente(x)?'Vigente hasta':'Finalizó'} ${fmtHasta(x)}</p>`:''}${x.lugar?`<p class="nplace">${esc(x.lugar)}</p>`:''}${x.texto?`<p class="ntext">${esc(x.texto)}</p>`:''}
    ${x.conv?'<span class="tag red" style="justify-self:start">Convocatoria · cuenta para la calificación</span>':''}${rsvpBlock(x,viewer)}${listaBlock(x,viewer)}<div class="nfoot"><span class="meta">Publicó ${esc(nice(x.autor))}</span><span class="row" style="gap:6px">${canArch?`<button class="btn small outline" data-archnews="${x.id}">Archivar</button>`:''}${canDel?`<button class="btn small" data-delnews="${x.id}">Borrar</button>`:''}</span></div></article>`;
}
// Confirmación de asistencia: los primeros "cupos" anotados son titulares; después, suplentes.
function rsvpBlock(x,viewer){
  if(!x.confirma)return '';
  const L=viewer&&S.navis?(S.navis[x.id]||[]):null, n=L?L.length:(+x.anot||0), cup=x.cupos, sup=x.suplentes||0;
  const pasada=!!(x.fecha&&x.fecha<dstr(new Date())), lleno=cup!=null&&n>=cup+sup;
  const cnt=cup!=null?`<b class="mono">${Math.min(n,cup)}/${cup}</b> confirmados${sup?` · suplentes <b class="mono">${Math.max(0,n-cup)}/${sup}</b>`:''}`:`<b class="mono">${n}</b> confirmado${n===1?'':'s'}`;
  let me='';
  if(L){const i=L.findIndex(a=>a.n===viewer);
    if(i>=0){const tit=cup==null||i<cup;me=`<span class="pill ${tit?'green':'yellow'}">${tit?'Vas':'Suplente N° '+(i-cup+1)}</span>${pasada?'':`<button class="btn small" data-nvno="${x.id}">Ya no asisto</button>`}`}
    else if(!pasada)me=lleno?'<span class="pill">Sin cupo</span>':`<button class="btn small go" data-nvsi="${x.id}">${cup!=null&&n>=cup?'Anotarme de suplente':'Asisto'}</button>`;
  } else if(!pasada)me=`<span class="meta">${lleno?'Sin cupo':'Ingresá con tu PIN para anotarte'}</span>`;
  const lista=L&&L.length?`<details class="nvlist"><summary>Ver anotados (${L.length})</summary><ol>${L.map((a,i)=>`<li>${esc(a.n)}${cup!=null&&i>=cup?' <span class="tag yellow">Suplente</span>':''}</li>`).join('')}</ol></details>`:'';
  return `<div class="rsvp"><div class="rsvp-top"><span>${cnt}</span><span class="rsvp-me">${me}</span></div>${lista}</div>`;
}
// Tomar asistencia de una convocatoria (después del evento): parte de los anotados y se corrige.
function listaBlock(x,viewer){
  if(!x.conv||!viewer||!hasRole(viewer)||!x.fecha||x.fecha>dstr(new Date()))return '';
  if(S.listaNov!==x.id)return `<button class="btn small outline" style="justify-self:start" data-tomalista="${x.id}">Tomar asistencia</button>`;
  const anot=new Set(((S.navis||{})[x.id]||[]).map(a=>a.n));
  return `<div class="rsvp"><b>¿Quiénes asistieron?</b><span class="meta">Vienen marcados los anotados. Corregí y guardá.</span>
    <div class="alrsel">${calSujetos().concat(active().filter(p=>p.cargo)).map(p=>`<label class="check"><input type="checkbox" data-pres="${p.id}" ${anot.has(p.n)?'checked':''}> ${esc(p.n)}</label>`).join('')}</div>
    <div class="row"><button class="btn small primary" data-guardalista="${x.id}">Guardar asistencia</button><button class="btn small" id="listano">Cancelar</button></div></div>`;
}
function vNews(viewer,compact){
  const can=viewer&&hasRole(viewer), up=upcomingNews(), t=dstr(new Date());
  const past=S.news.filter(x=>!vigente(x)).sort((a,b)=>(b.hasta||b.fecha||'').localeCompare(a.hasta||a.fecha||''));
  const form=can?(S.newsForm?`<div class="card" style="margin-bottom:16px"><h3>Nueva novedad</h3>
      <div class="row"><div class="field"><label class="label" for="nv_tipo">Tipo</label><select id="nv_tipo">${S.tipos.map(x=>`<option>${esc(x)}</option>`).join('')}</select>${roleOf(viewer)==='admin'?'<button class="linkbtn" id="edittipos">Editar tipos</button>':''}</div>
      <div class="field" style="flex:3 1 240px"><label class="label" for="nv_tit">Título</label><input id="nv_tit" placeholder="Ej.: Curso de rescate vehicular"></div></div>
      <div class="row"><div class="field"><label class="label" for="nv_fecha">Fecha (opcional)</label><input id="nv_fecha" type="date"></div>
      <div class="field"><label class="label" for="nv_hora_h">Hora (opcional)</label>${horaSel('nv_hora','',true)}</div>
      <div class="field" style="flex:2 1 200px"><label class="label" for="nv_lugar">Lugar</label><input id="nv_lugar" placeholder="Ej.: Salón del cuartel"></div></div>
      <div class="field"><label class="label" for="nv_txt">Detalle</label><textarea id="nv_txt" rows="3" placeholder="Inscripción, requisitos, qué llevar…"></textarea></div>
      <div class="row"><div class="field"><label class="label" for="nv_hasta">Vigente hasta (opcional)</label><input id="nv_hasta" type="date" min="${dstr(new Date())}"></div>
      <div class="field"><label class="label" for="nv_hasta_t_h">Hora</label>${horaSel('nv_hasta_t','',true)}</div></div>
      <p class="demo" style="margin:4px 0 0">Para avisos como un alerta meteorológico: a esa fecha y hora pasa solo a "anteriores". Si no lo completás, queda vigente hasta el final del día del evento (o hasta que lo archives, si no tiene fecha).</p>
      <label class="check"><input type="checkbox" id="nv_conf"> Pedir confirmación de asistencia (cada bombero se anota desde la app)</label>
      <div class="row" id="nv_cupbox" hidden><div class="field"><label class="label" for="nv_cup">Cupos (vacío = sin límite)</label><input id="nv_cup" type="number" min="1" max="500" inputmode="numeric" placeholder="Ej.: 10"></div>
      <div class="field"><label class="label" for="nv_sup">Lugares de suplente</label><input id="nv_sup" type="number" min="0" max="500" value="0" inputmode="numeric"></div>
      <label class="check" style="flex:1 1 100%"><input type="checkbox" id="nv_convoc"> Es una convocatoria: cuenta para la calificación (necesita fecha; sin cupo, para que todos puedan ir)</label></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="addnews">Publicar y notificar</button><button class="btn" id="togglenews">Cancelar</button></div></div>`
    :`<button class="btn primary big" id="togglenews" style="margin:0 0 16px">Publicar novedad</button>`):'';
  const isAdm=roleOf(viewer)==='admin';
  const editor=isAdm&&S.editTipos?`<div class="card alert" style="margin-bottom:16px"><div class="top"><h3>Tipos de novedad</h3><button class="btn small outline" id="edittipos">Cerrar</button></div>
    <p class="demo" style="margin:0 0 8px">Si renombrás un tipo, las novedades que ya lo usan se actualizan. Solo se puede borrar un tipo que no esté en uso.</p>
    <ul class="list">${S.tipos.map((x,i)=>{const n=S.news.filter(y=>y.tipo===x).length;return `<li><input class="tpin" id="tp_${i}" value="${esc(x)}" aria-label="Nombre del tipo"><span class="meta">${n} en uso</span><button class="btn small" data-deltipo="${i}">Borrar</button></li>`}).join('')}</ul>
    <div class="row" style="margin-top:10px"><div class="field" style="margin:0"><label class="label" for="tp_new">Nuevo tipo</label><input id="tp_new" placeholder="Ej.: Reunión"></div></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="savetipos">Guardar cambios</button><button class="btn outline" id="addtipo">Agregar tipo</button></div></div>`:'';
  return `${editor}${form}<div class="newsgrid">${up.map(x=>newsCard(x,viewer)).join('')||'<p class="empty">No hay novedades próximas.</p>'}</div>
  ${past.length?`<div class="section-h"><h3 style="margin:0">Eventos pasados</h3><button class="btn small outline" id="togglepast">${S.showPast?'Ocultar':'Ver los '+past.length}</button></div>${S.showPast?`<div class="newsgrid past">${past.map(x=>newsCard(x,viewer)).join('')}</div>`:''}`:''}`;
}
function vNovedadesTab(){
  const s=sess();
  if(s.step==='who')return vWho('Ingresar a novedades','Con tu PIN te anotás en cursos y eventos. Administradores, jefatura y superiores también publican.',active())+'<p style="margin-top:18px"><button class="btn outline" id="backnews">Volver a novedades</button></p>';
  if(s.step==='pin')return vPin('Ingresá tu PIN',nice(s.who));
  if(s.step==='newpin')return vNewPin();
  const v=s.step==='me'?s.who:null;
  return `<div class="who"><div><span class="label">${v?esc(nice(v))+' · '+roleLabel(v):'Cursos, charlas, eventos y avisos'}</span><h2>Novedades</h2></div>
    ${v?'<button class="btn outline" id="bye">Salir</button>':'<button class="btn outline" id="loginnews">Ingresar con mi PIN</button>'}</div>${vNews(v,false)}`;
}

/* ---------- PROTECTOR DE PANTALLA Y NOTIFICACIÓN ---------- */
let saverAt=0,saverRot;
function showSaver(){
  if(S.saver)return;
  if(S.tab!=='kiosco'){S.tab='kiosco';S.mode=null}
  S.kmode=null;SIR.confirm=null;
  Object.assign(S.sess.kiosco,{step:'who',who:null,pin:'',q:''});S.mode=null;S.motivo=null;
  S.saver=true;saverAt=Date.now();renderSaver();$('#saver').hidden=false;
}
function hideSaver(){S.saver=false;$('#saver').hidden=true;clearInterval(saverRot);S.tab='kiosco';render()}
function renderSaver(){
  const d=new Date(),up=upcomingNews(),many=up.length>4;
  const inside=[...S.adentro];
  const insideHtml=`<div class="sv-h">En el cuartel ahora · ${inside.length}</div>${inside.length?`<div class="sv-in-grid">${inside.map(r=>{const [ln,fn]=split(r.b),p=member(r.b);
    return `<div class="sv-person"><div class="sv-pn">${esc(ln)} <span>${esc(fn)}</span></div><div class="sv-pm">${esc(r.m)}</div><div class="sv-pt mono">desde ${fmtD(r.i).slice(6)} · ${fmtH((Date.now()-P(r.i))/36e5)} h</div></div>`}).join('')}</div>`:'<p class="sv-empty">No hay nadie fichado en este momento.</p>'}`;
  $('#saver').innerHTML=`<div class="stripe"></div>${saverAlerts()}<div class="sv-wrap">
    <div class="sv-side">
      <img class="sv-logo" src="icons/escudo-400.png" alt="Escudo Bomberos Voluntarios Isla Verde">
      <div class="sv-title">Asoc. Bomberos Voluntarios Isla Verde</div>
      <div class="sv-clock mono">${pad(d.getHours())}:${pad(d.getMinutes())}</div>
      <div class="sv-date">${d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>
      <div class="sv-duty">Guardia ${guardAt(d)} en servicio</div>
      <div class="sv-hint">Tocá la pantalla o mové el mouse para registrar tu asistencia</div>
    </div>
    <div class="sv-main">${insideHtml}
    ${up.length?`<div class="sv-h" style="margin-top:22px">Novedades · ${up.length}</div>
      <div class="sv-grid ${many?'many':''}">${up.map(x=>`<div class="sv-news"><div class="sv-top"><span class="tag ${x.tipo==='Evento'?'red':'yellow'}">${esc(x.tipo)}</span><span class="sv-nd">${fmtNewsDate(x)}</span></div>
        <div class="sv-nt">${esc(x.titulo)}</div>${x.hasta?`<div class="sv-cup">Vigente hasta ${fmtHasta(x)}</div>`:''}${x.lugar?`<div class="sv-pl">${esc(x.lugar)}</div>`:''}${x.confirma?`<div class="sv-cup">${x.cupos!=null?`${Math.min(+x.anot,x.cupos)}/${x.cupos} confirmados`:`${x.anot} confirmados`} · anotate desde la app</div>`:''}${x.texto?`<p>${esc(x.texto)}</p>`:''}</div>`).join('')}</div>`:''}</div>
  </div>`;
}

function vFichaGuardia(b){
  const ms=months(), p=member(b), st=ms.map(k=>monthStats(b,k));
  const line=(t,f,cls='')=>`<tr><td>${t}</td>${st.map(x=>{const v=f(x);return `<td class="num ${v?cls:'zero'}">${v}</td>`}).join('')}<td class="num">${st.reduce((s,x)=>s+f(x),0)}</td></tr>`;
  const lineH=(t,mo)=>{const v=ms.map(k=>guardHours(b,k,mo));return `<tr><td>${t}</td>${v.map(x=>`<td class="num ${x?'':'zero'}">${fmtH(x)}</td>`).join('')}<td class="num">${fmtH(v.reduce((a,c)=>a+c,0))}</td></tr>`};
  return `<div class="section-h"><h3 style="margin:0">Ficha de guardia: ${esc(b)}</h3><span class="pill red">Guardia ${p.g||'—'}</span></div>
  <div class="tablewrap"><table><thead><tr><th>Concepto</th>${ms.map(k=>`<th class="num">${MESES[+k.slice(5)-1].slice(0,3)}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
  ${line('<b>Guardias cumplidas</b>',x=>x.total)}${line('&nbsp;&nbsp;Propias',x=>x.comp+x.par)}${line('&nbsp;&nbsp;Como reemplazo',x=>x.reps)}${line('Ausencias con reemplazo',x=>x.aus)}${line('Sin registro',x=>x.sin,'warn')}${line('Fuera de hora',x=>x.late,'warn')}
  ${lineH('Horas de capacitación',CAP)}${lineH('Horas de mant. / limpieza',MANT)}
  </tbody></table></div>`;
}
function vFichaAsist(b){
  const ms=months(), p=member(b);
  const h=S.horas.filter(r=>r.b===b&&r.f&&!MOTIVOS_GUARDIA.includes(r.m));
  const mot=motivosTodos().filter(mo=>h.some(r=>r.m===mo));
  const cell=(mo,k)=>h.filter(r=>r.m===mo&&mkey(r.i)===k).reduce((s,r)=>s+hrs(r),0);
  const colTot=k=>mot.reduce((s,mo)=>s+cell(mo,k),0);
  const det=h.filter(r=>mkey(r.i)===S.month).sort((a,c)=>a.i.localeCompare(c.i));
  return `<div class="section-h"><h3 style="margin:0">Asistencia general: ${esc(b)}</h3><span class="pill">Guardia ${p.g||'—'}</span></div>
  <div class="tablewrap"><table><thead><tr><th>Actividad</th>${ms.map(k=>`<th class="num">${MESES[+k.slice(5)-1].slice(0,3)}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
  ${mot.map(mo=>`<tr><td>${esc(mo)}</td>${ms.map(k=>{const v=cell(mo,k);return `<td class="num ${v?'':'zero'}">${fmtH(v)}</td>`}).join('')}<td class="num">${fmtH(ms.reduce((s,k)=>s+cell(mo,k),0))}</td></tr>`).join('')||`<tr><td colspan="${ms.length+2}" class="empty">Sin horas de asistencia general.</td></tr>`}
  <tr class="tot"><td>Total horas</td>${ms.map(k=>`<td class="num">${fmtH(colTot(k))}</td>`).join('')}<td class="num">${fmtH(ms.reduce((s,k)=>s+colTot(k),0))}</td></tr>
  </tbody></table></div>
  <div class="section-h"><span class="label">Registros de ${MESES[+S.month.slice(5)-1].toLowerCase()}</span></div>
  <div class="card"><ul class="list">${det.map(r=>`<li><span>${esc(r.m)}${r.d?`<br><span class="meta">${esc(r.d)}</span>`:''}${r.manual?' <span class="pill yellow">a revisar</span>':''}</span><span class="meta mono" style="text-align:right">${fmtD(r.i)} → ${fmtD(r.f).slice(6)}<br><b style="color:var(--ink)">${fmtH(hrs(r))} h</b></span></li>`).join('')||'<li class="empty">Sin registros este mes.</li>'}</ul></div>`;
}

/* ---------- render + eventos ---------- */
const TABS=['kiosco','guardia','alertas','sci','epp','novedades','panel'];
function isLogged(){const s=sess();if(S.tab==='panel')return !!S.admin||s.step!=='who';return ['pin','me','newpin'].includes(s.step)}
/* Inactividad: se mide desde la última acción real de la persona (mouse, teclado, toque).
   Los refrescos automáticos de pantalla NO cuentan como actividad. */
let lastAct=Date.now();
function resetIdle(){lastAct=Date.now()}
function idleCheck(){
  if(S.saver||sirenBusy())return;
  const idle=Date.now()-lastAct;
  if(isLogged()){
    const lim=S.tab==='kiosco'?S.cfg.kioskSec*1000:S.cfg.appMin*60000;
    if(idle>=lim){S.admin=null;S.ficha=null;S.sirena=false;logoutSess();toast('Sesión cerrada por inactividad. Ingresá tu PIN de nuevo.')}
  }
  // En la PC del cuartel, después de unos minutos sin uso aparece el protector (desde cualquier pestaña).
  if(isKiosk()&&idle>=S.cfg.saverMin*60000){
    if(isLogged()){S.admin=null;S.ficha=null;S.sirena=false;logoutSess()}
    showSaver();
  }
}
setInterval(idleCheck,2000);
function logoutSess(){
  const s=sess();
  if(s.tok)rpc('logout',{tok:s.tok}).catch(()=>{});
  Object.assign(s,{step:S.tab==='novedades'?'list':'who',who:null,pin:'',np1:null,tok:null,forced:false});
  if(S.tab==='panel')S.admin=null;
  if(S.tab==='kiosco'){S.kmode=null;SIR.confirm=null;SIR.cfgOpen=false}
  S.mode=null;S.motivo=null;S.est=null;S.newsForm=false;S.editP=null;S.confirmBaja=null;S.editTipos=false;
  clearPrivate();render();loadPublic().then(render);
}
function render(){
  if(S.recargar&&!isLogged()&&!S.busy){S.recargar=false;location.reload();return}
  for(const t of TABS){const b=$('#tab-'+t);b.setAttribute('aria-selected',S.tab===t);if(t==='kiosco')b.hidden=!isKiosk()}
  fitHeader();
  renderDuty();
  if(!S.loaded){$('#view').innerHTML=`<p class="lead">${S.netErr?esc(S.netErr):'Cargando…'}</p>`;return}
  renderAlertBar();
  $('#view').innerHTML=ayudaBox()+(S.tab==='kiosco'?vKiosco():S.tab==='guardia'?vGuardia():S.tab==='alertas'?vAlertas():S.tab==='sci'?vSCI():S.tab==='epp'?vEPP():S.tab==='novedades'?vNovedadesTab():vPanelTab());
  sirState();liveTick();
}
function liveTick(){
  const el=$('#since');if(el){const o=openOf(S.sess.kiosco.who);if(o)el.textContent=fmtH((Date.now()-P(o.i))/36e5)+' h'}
  const cd=$('#cd');if(cd){const l=deadline(currentNight())-Date.now();cd.textContent=l>0?fmtH(l/36e5)+' h':'0:00 h'}
}
async function enterOk(s){
  if(S.tab==='panel'){S.admin=s.who;s.step='who';const sc=scopeOf(s.who);S.gfilter=sc==='all'?'all':String(sc);S.ptab='guardia'}
  else s.step='me';
  if(S.tab==='guardia'){LS.set('bviv_yo',s.who);syncPush(true)}
  await reload();
}
function pinErr(m){render();const e=$('#pinerr');if(e)e.textContent=m}
async function pinKey(k){
  const s=sess();
  if(S.busy)return;
  if(k==='x'){
    if(s.step==='newpin'&&!s.forced&&S.tab!=='panel'){s.pin='';s.np1=null;s.step='me';render();return}
    if(S.tab==='guardia'&&s.step==='pin')LS.set('bviv_yo',null);
    s.pin='';logoutSess();return}
  if(k==='b'){s.pin=s.pin.slice(0,-1);render();return}
  if(s.pin.length>=4)return;
  s.pin+=k;render();
  if(s.pin.length<4)return;
  const v=s.pin;s.pin='';
  if(s.step==='newpin'){
    if(!s.np1){if(weakPin(v)){pinErr('Elegí otro: que no sean números iguales ni seguidos.');return}s.np1=v;render();return}
    if(v!==s.np1){s.np1=null;pinErr('No coinciden. Empezá de nuevo.');return}
    S.busy=true;
    try{await rpc('cambiar_pin',{tok:s.tok,nuevo:v});s.np1=null;s.forced=false;toast('PIN actualizado.');S.busy=false;await enterOk(s)}
    catch(e){S.busy=false;s.np1=null;pinErr(e.message)}
    return;
  }
  const p=member(s.who);if(!p){logoutSess();return}
  S.busy=true;render();
  let res;
  try{res=await rpc('login',{pid:p.id,pin:v})}catch(e){S.busy=false;pinErr(e.message);return}
  S.busy=false;
  if(res.error){pinErr(res.error);return}
  const needRole=S.tab==='panel'||(S.tab==='kiosco'&&S.kmode==='sirena');
  if(needRole&&!res.rol){rpc('logout',{tok:res.token}).catch(()=>{});pinErr('No tenés permiso para entrar acá.');return}
  s.tok=res.token;
  if(res.cambiar){s.forced=true;s.step='newpin';s.np1=null;render();return}
  await enterOk(s);
}
function keepFields(fn){const ids=['desc','mi','mf','rep','gnote','cd1','cd2','ci_h','ci_m','cf_h','cf_m'];const v={};ids.forEach(i=>{const e=$('#'+i);if(e)v[i]=e.value});fn();ids.forEach(i=>{const e=$('#'+i);if(e&&v[i]!==undefined)e.value=v[i]});const b=$('#durbox');if(b&&$('#mi'))b.innerHTML=durManual();if(b&&$('#cd1'))b.innerHTML=durCursoAhora()}
const viewerNow=()=>S.tab==='panel'?S.admin:sess().who;
const pid=n=>member(n)?.id;

/* ---------- notificaciones push ---------- */
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
const pushOk=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const pushOn=()=>pushOk()&&Notification.permission==='granted'&&LS.get('bviv_push')==='1';
function b64(s){const p='='.repeat((4-s.length%4)%4);const r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))}
async function syncPush(silent){
  if(!pushOk()){if(!silent)toast(isIOS&&!isStandalone()?'En iPhone: tocá Compartir → "Agregar a inicio" y abrí la app desde ese ícono.':'Este navegador no admite notificaciones.');return}
  if(silent&&Notification.permission!=='granted')return;
  try{
    if(Notification.permission!=='granted'){const r=await Notification.requestPermission();if(r!=='granted'){toast('Sin permiso no te podemos avisar. Se habilita en la configuración del navegador.');return}}
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(CONFIG.VAPID_PUBLIC_KEY)});
    const j=sub.toJSON();
    await rpc('guardar_suscripcion',{tok:S.sess.guardia.tok,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth});
    LS.set('bviv_push','1');if(!silent){toast('Listo: vas a recibir los avisos en este celular.');render()}
  }catch(e){if(!silent)toast('No se pudieron activar los avisos: '+e.message)}
}

document.addEventListener('click',async e=>{
  armBack();   // con un toque del usuario, así Chrome respeta la entrada del historial
  const t=e.target.closest('button,tr[data-ficha],tr[data-ivper]');if(!t||t.disabled)return;resetIdle();
  if(t.id&&t.id.startsWith('tab-')&&sirenBusy()){toast('Primero detené la sirena.');return}
  if(t.id==='helpbtn'||t.id==='helpclose'){S.help=t.id==='helpbtn'&&!S.help;render();if(S.help)window.scrollTo({top:0,behavior:'smooth'});return}
  if(await alertGlobal(t))return;
  if(t.id&&t.id.startsWith('tab-')){const nt=t.id.slice(4);if(nt===S.tab)return;if(isLogged())logoutSess();S.tab=nt;S.mode=null;S.motivo=null;S.est=null;S.newsForm=false;S.motOpen=false;S.motEdit=null;S.help=false;prefillYo();render();return}
  if(t.dataset.scitab&&await sciAction(t))return;
  if(t.id==='opensiren'){S.kmode='sirena';Object.assign(S.sess.kiosco,{step:'who',who:null,pin:'',q:''});S.mode=null;render();return}
  if(t.id==='closesiren'){S.kmode=null;logoutSess();return}
  if(S.tab==='kiosco'&&S.kmode==='sirena'&&S.sess.kiosco.step==='me'&&await sirenAction(t))return;
  if(t.dataset.who){const s=sess();s.who=t.dataset.who;s.step='pin';s.pin='';render();return}
  if(t.dataset.k){pinKey(t.dataset.k);return}
  if(S.tab==='sci'&&sess().step==='me'&&(await sciCfgAction(t)||await sciAction(t)))return;
  if(S.tab==='epp'&&sess().step==='me'&&await eppAction(t))return;
  if(S.tab==='alertas'&&await alertAction(t))return;
  if((S.tab==='panel'||S.tab==='guardia')&&await califAction(t))return;
  if((S.tab==='panel'||S.tab==='guardia')&&await legajoAction(t))return;
  if((S.tab==='panel'||S.tab==='guardia')&&await tareasAction(t))return;
  if((t.id==='editmot'||S.motEdit)&&await motAction(t))return;
  if(t.id==='bye'){if(sirenBusy())await sirenStop();logoutSess();return}
  if(t.id==='notyo'){LS.set('bviv_yo',null);logoutSess();return}
  if(t.id==='chpin'){const s=sess();s.step='newpin';s.np1=null;s.pin='';s.forced=false;render();return}
  if(t.id==='showsaver'){showSaver();return}
  if(t.id==='pushon'){syncPush(false);return}
  if(t.id==='loginnews'){const s=sess();s.step='who';s.q='';render();return}
  if(t.id==='backnews'){logoutSess();return}
  if(t.id==='edittipos'){S.editTipos=!S.editTipos;render();return}
  if(t.id==='addtipo'||t.id==='savetipos'||t.dataset.deltipo!==undefined){const v=viewerNow();if(roleOf(v)!=='admin')return;
    if(t.dataset.deltipo!==undefined){const x=S.tipos[+t.dataset.deltipo];await act('guardar_tipos',{cambios:[{viejo:x,nuevo:null}],nuevos:[]},`Tipo "${x}" borrado.`);return}
    if(t.id==='addtipo'){const x=$('#tp_new').value.trim();if(!x){toast('Escribí el nombre del tipo.');return}
      if(S.tipos.some(y=>y.toLowerCase()===x.toLowerCase())){toast('Ese tipo ya existe.');return}
      await act('guardar_tipos',{cambios:[],nuevos:[x]},`Tipo "${x}" agregado.`);return}
    const nuevos=S.tipos.map((_,i)=>$('#tp_'+i).value.trim());
    if(nuevos.some(x=>!x)){toast('Ningún tipo puede quedar vacío.');return}
    if(new Set(nuevos.map(x=>x.toLowerCase())).size!==nuevos.length){toast('Hay dos tipos con el mismo nombre.');return}
    const cambios=S.tipos.map((x,i)=>({viejo:x,nuevo:nuevos[i]})).filter(c=>c.viejo!==c.nuevo);
    if(await act('guardar_tipos',{cambios,nuevos:[]},'Tipos actualizados.'))S.editTipos=false,render();return}
  if(t.id==='togglepast'){S.showPast=!S.showPast;render();return}
  if(t.id==='togglenews'){S.newsForm=!S.newsForm;render();return}
  if(t.id==='addnews'){const v=viewerNow();if(!hasRole(v))return;
    const tit=$('#nv_tit').value.trim();if(tit.length<3){toast('Poné un título.');return}
    const conf=$('#nv_conf').checked, cup=conf&&$('#nv_cup').value?+$('#nv_cup').value:null;
    const hd=$('#nv_hasta').value, hasta=hd?`${hd}T${horaVal('nv_hasta_t')||'23:59'}`:null;
    if(hasta&&P(hasta)<=new Date()){toast('La fecha y hora "vigente hasta" ya pasó.');return}
    if(conf&&$('#nv_convoc').checked&&!$('#nv_fecha').value){toast('Una convocatoria necesita fecha.');return}
    if(cup!=null&&!(cup>=1)){toast('Los cupos tienen que ser 1 o más.');return}
    if(await act('publicar_novedad',{tipo:$('#nv_tipo').value,titulo:tit,fecha:$('#nv_fecha').value||null,hora:horaVal('nv_hora')||null,lugar:$('#nv_lugar').value,texto:$('#nv_txt').value,
      confirma:conf,cupos:cup,suplentes:cup!=null?Math.max(0,+$('#nv_sup').value||0):null,hasta,convocatoria:conf&&$('#nv_convoc').checked},'Publicada. Se avisó a todos los celulares con avisos activados.')){S.newsForm=false;render()}
    return}
  if(t.dataset.nvsi||t.dataset.nvno){const si=!!t.dataset.nvsi;
    await act('nov_asistir',{nid:+(t.dataset.nvsi||t.dataset.nvno),asiste:si},r=>({titular:'Listo: quedaste anotado.',suplente:'Quedaste como suplente. Si se libera un cupo, te avisamos.',ya:'Ya estabas anotado.',baja:'Listo: te bajaste. Gracias por avisar.',no:'No estabas anotado.'}[r]||'Listo.'));return}
  if(t.dataset.tomalista){S.listaNov=+t.dataset.tomalista;render();return}
  if(t.id==='listano'){S.listaNov=null;render();return}
  if(t.dataset.guardalista){const ids=[...document.querySelectorAll('[data-pres]:checked')].map(c=>+c.dataset.pres);
    try{const n=await call('nov_tomar_lista',{nid:+t.dataset.guardalista,presentes:ids});toast(`Asistencia guardada: ${n} presentes.`);S.listaNov=null;S.calD=null;render()}catch(e){}return}
  if(t.dataset.archnews){if(!confirmTwice(t,'Tocá de nuevo para archivarla: pasa a "anteriores".'))return;await act('archivar_novedad',{nid:+t.dataset.archnews},'Novedad archivada.');return}
  if(t.dataset.delnews){await act('borrar_novedad',{nid:+t.dataset.delnews},'Novedad borrada.');return}
  if(t.dataset.mode!==undefined){if(S.mode==='legajo'){S.legSel=null;S.legD=null;S.legP=null;S.legEdit=null}S.actPrefill=null;if(t.dataset.mode==='tareas'){S.tar=null;S.tarFin=null;S.tarHecha=null}S.mode=t.dataset.mode||null;S.motivo=null;S.est=null;S.newsForm=false;render();return}
  if(t.dataset.mot){keepFields(()=>{S.motivo=t.dataset.mot;render()});return}
  if(t.dataset.est){keepFields(()=>{S.est=t.dataset.est;render()});return}
  const who=sess()?.who;
  if(t.id==='doin'){if(await act('fichar_entrada',{kiosco:KIOSK_KEY(),motivo:S.motivo,descripcion:$('#desc').value},'Entrada registrada. Acordate de fichar la salida.')){S.mode=null;render()}return}
  if(t.id==='out'){const tope=+(S.cfg.topeHoras||14);const r=await act('fichar_salida',{kiosco:KIOSK_KEY()},h=>+h>=tope?`Pasaste las ${tope} h sin fichar la salida: se contaron ${tope} h y queda para que un encargado lo revise.`:`Salida registrada: ${fmtH(+h)} h. ¡Gracias, ${split(who)[1]}!`);if(r)logoutSess();return}
  if(t.id==='docurso'){const d1=$('#cd1').value,d2=$('#cd2').value,a=horaVal('ci'),z=horaVal('cf');
    if(!d1||!d2||d2<d1){toast('Revisá las fechas: "hasta" tiene que ser igual o posterior a "desde".');return}
    if(await act('cargar_curso',{kiosco:KIOSK_KEY(),motivo:S.motivo,descripcion:$('#desc').value,desde:d1,hasta:d2,inicio:a,fin:z},h=>`Listo: ${fmtH(+h)} h cargadas. Un encargado las va a revisar.`)){S.mode=null;render()}return}
  if(t.id==='domanual'){const i=$('#mi').value,f=$('#mf').value;
    if(!i||!f||f<=i){toast('La salida tiene que ser posterior a la entrada.');return}
    if(await act('cargar_manual',{kiosco:KIOSK_KEY(),motivo:S.motivo,descripcion:$('#desc').value,entrada:i,salida:f},'Horas guardadas. Un encargado las va a revisar.')){S.mode=null;render()}return}
  if(t.id==='doguard'){const r=$('#rep')?.value||null;
    if(S.est==='ausente'&&!r){toast('Elegí quién te reemplaza.');return}
    const res=await act('registrar_guardia',{estado:S.est,reemplazo:r?pid(r):null,horario:$('#gnote')?.value||null},x=>x?.fueraDeHora?'Guardia registrada fuera de hora.':'Guardia registrada.');
    if(res){S.mode=null;S.est=null;render()}return}
  if(t.id==='doact'){const d=$('#ad').value,a=horaVal('ai'),z=horaVal('af');
    if(!d||!a||!z){toast('Completá fecha, inicio y fin.');return}
    {const m=x=>+x.slice(0,2)*60+ +x.slice(3);let fin=P(d);fin.setMinutes(m(z)+(m(z)<=m(a)?1440:0));
     if(fin-Date.now()>15*60000){toast('No se pueden cargar horas a futuro: revisá la fecha y la hora de fin.');return}}
    const cap=t.dataset.act==='cap';
    if(await act('cargar_actividad',{tipo:t.dataset.act,fecha:d,inicio:a,fin:z,descripcion:$('#at').value},h=>`${cap?'Capacitación':'Mantenimiento'} guardado: ${fmtH(+h)} h.`)){S.mode=null;render()}return}
  if(t.id==='logout'){S.admin=null;S.ficha=null;logoutSess();return}
  if(t.dataset.close){await act('gestionar_hora',{hid:+t.dataset.close,accion:'cerrar'},'Registro cerrado.');return}
  if(t.dataset.ok){await act('gestionar_hora',{hid:+t.dataset.ok,accion:'aprobar'},'Carga aprobada.');return}
  if(t.dataset.del){await act('gestionar_hora',{hid:+t.dataset.del,accion:'borrar'},'Carga borrada.');return}
  if(await personalAction(t,viewerNow()))return;
  if(t.id==='dlx'){downloadReport(viewerNow());return}
  if(t.dataset.gper){S.gper=t.dataset.gper;S.ficha=null;render();return}
  if(t.id==='pdfweek'){pdfSemana(viewerNow());return}
  if(t.id==='pdfmonth'){pdfMesGuardia(viewerNow());return}
  if(t.id==='pdfofi'){pdfOficial(viewerNow());return}
  if(t.dataset.ptab){S.ptab=t.dataset.ptab;S.ficha=null;S.editP=null;S.confirmBaja=null;S.legSel=null;S.legEdit=null;S.legP=null;S.legD=null;S.legCat=null;if(S.ptab==='tareas'){S.tar=null;S.tarDev=null}render();return}
  if(t.dataset.ficha){S.ficha=S.ficha===t.dataset.ficha?null:t.dataset.ficha;render();if(S.ficha)$('#ficha').scrollIntoView({behavior:'smooth',block:'start'});return}
  if(t.id==='csv'){const v=viewerNow();let txt;
    if(S.ptab==='asist'&&canAsist(v)){const rows=people(v).map(p=>agStats(p.n,S.month));const mots=motivosTodos().filter(mo=>rows.some(r=>r.by[mo]));
      txt=['Bombero\t'+mots.join('\t')+'\tTotal',...rows.map(r=>[r.n,...mots.map(mo=>(r.by[mo]||0).toFixed(2)),r.tot.toFixed(2)].join('\t'))].join('\n');}
    else{const rows=rowsFor(S.month,v);
      txt=['Bombero\tGuardia\tGuardias\tPropias\tReemplazos\tParciales\tAusencias\tSin registro\tFuera de hora\tH. capacitación\tH. mant./limp.',...rows.map(r=>[r.n,r.g||'',r.total,r.comp+r.par,r.reps,r.par,r.aus,r.sin,r.late,guardHours(r.n,S.month,CAP).toFixed(2),guardHours(r.n,S.month,MANT).toFixed(2)].join('\t'))].join('\n');}
    navigator.clipboard.writeText(txt).then(()=>toast('Tabla copiada. Pegala en Sheets.'),()=>toast('Este navegador no dejó copiar automáticamente.'));return}
});
document.addEventListener('input',e=>{if(e.target.id==='mi'||e.target.id==='mf'){const b=$('#durbox');if(b)b.innerHTML=durManual();return}if(S.tab==='sci'&&sciInput(e))return;if(e.target.id==='if_q'&&S.eppIF){S.eppIF.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#if_q');q.focus();q.setSelectionRange(pos,pos);return}if(e.target.id==='ef_q'&&S.eppFil){S.eppFil.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#ef_q');q.focus();q.setSelectionRange(pos,pos);return}if(e.target.id==='q'){sess().q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#q');q.focus();q.setSelectionRange(pos,pos)}});
document.addEventListener('change',e=>{const did=e.target.id||'';if(/^(ci|cf)_(h|m)$/.test(did)||did==='cd1'||did==='cd2'){const b=$('#durbox');if(b)b.innerHTML=durCursoAhora();return}if(/^(ai|af)_(h|m)$/.test(did)){const b=$('#durbox');if(b)b.innerHTML=durAct();return}if(did==='mi'||did==='mf'){const b=$('#durbox');if(b)b.innerHTML=durManual();return}if(e.target.id==='nv_conf'){const b=$('#nv_cupbox');if(b)b.hidden=!e.target.checked;return}if(alertChange(e))return;if(califChange(e))return;if(legajoChange(e))return;if(tareasChange(e))return;if(S.tab==='sci'&&typeof sciChange==='function'&&sciChange(e))return;if(S.tab==='epp'&&eppChange(e))return;if(e.target.id==='sn_reas'){S.sinReasign=e.target.checked;render();return}if(S.rep&&['rb','rf','rt'].includes(e.target.id)){S.rep[{rb:'b',rf:'from',rt:'to'}[e.target.id]]=e.target.value;render();return}if(e.target.id==='fm'){S.month=e.target.value;render()}if(e.target.id==='fw'){S.week=e.target.value;render()}if(e.target.id==='fg'){S.gfilter=e.target.value;render()}});
document.addEventListener('keydown',e=>{
  if(S.saver||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
  if(!document.querySelector('.pindots'))return;
  let k=null;
  if(/^[0-9]$/.test(e.key))k=e.key; else if(e.key==='Backspace'||e.key==='Delete')k='b'; else if(e.key==='Escape')k='x';
  if(k===null)return;
  e.preventDefault();resetIdle();pinKey(k);
});
['mousemove','mousedown','keydown','touchstart','wheel'].forEach(ev=>document.addEventListener(ev,()=>{resetIdle();if(S.saver&&Date.now()-saverAt>900)hideSaver()},{passive:true}));

/* ---------- botón "atrás" del celular ----------
   La app es una sola página: sin esto, "atrás" cierra la app. Se deja una entrada en el historial
   y, al tocar atrás, se vuelve un paso dentro de la app. Solo en la pantalla inicial "atrás" sale. */
function goBack(){
  if(S.help){S.help=false;return true}
  if(S.saver)return true;
  const s=sess()||{};
  if(S.motOpen){S.motOpen=false;S.motEdit=null;return true}
  if(S.tab==='sci'){
    if(S.ptOpen){S.ptOpen=null;S.ptDraft=null;S.ptPrensa=null;return true}
    if(S.sinNew){S.sinNew=false;return true}
    if(S.sciSel){S.sciSel=null;return true}
    if(S.sciTab==='cfg'){S.sciTab='dot';S.sciEdit=null;return true}
  }
  if(S.tab==='epp'){
    if(S.eppInvEd){S.eppInvEd=null;return true}
    if(S.eppEnt){S.eppEnt=null;S.eppEntF=null;return true}
    if(S.eppRej){S.eppRej=null;return true}
    if(S.eppPer){S.eppPer=null;return true}
    if(s.step==='me'&&S.eppTab&&S.eppTab!=='mis'){S.eppTab='mis';S.eppCat=null;return true}
  }
  if(S.tab==='alertas'){
    if(S.alrRoja){S.alrRoja=null;return true}
    if(S.alrNew){S.alrNew=false;return true}
  }
  if(S.newsForm){S.newsForm=false;return true}
  if(S.tarFin&&S.mode==='tareas'){S.tarFin=null;return true}
  if(S.tarDev){S.tarDev=null;return true}
  if(S.legEdit&&((S.tab==='panel'&&S.ptab==='legajos')||S.mode==='legajo')){S.legEdit=null;S.legCat=null;S.legDraft=null;S.legFile=null;return true}
  if(S.tab==='panel'&&S.admin&&S.ptab==='legajos'&&S.legSel){S.legSel=null;S.legD=null;S.legP=null;return true}
  if(S.tab==='panel'&&S.admin){
    if(S.ficha){S.ficha=null;return true}
    if(S.editP||S.confirmBaja){S.editP=null;S.confirmBaja=null;return true}
    if(S.ptab==='guardia'&&S.gper==='semana'){S.gper='mes';return true}
    if(S.ptab!=='guardia'){S.ptab='guardia';return true}
  }
  if(S.tab==='kiosco'&&S.kmode==='sirena'&&!sirenBusy()){S.kmode=null;logoutSess();return true}
  if(S.mode){S.mode=null;S.motivo=null;S.est=null;return true}
  if(s.step==='newpin'&&!s.forced&&s.tok){s.step='me';s.pin='';s.np1=null;return true}
  if(s.step==='pin'){if(S.tab==='guardia'||S.tab==='alertas')LS.set('bviv_yo',null);s.step=S.tab==='novedades'?'list':'who';s.pin='';s.who=null;return true}
  if(S.tab==='novedades'&&s.step==='who'){s.step='list';return true}
  return false;
}
function armBack(){try{if(!history.state||!history.state.bviv)history.pushState({bviv:1},'')}catch(e){}}
window.addEventListener('popstate',()=>{
  resetIdle();
  if(goBack()){try{history.pushState({bviv:1},'')}catch(e){}render();window.scrollTo(0,0)}
  else history.back();   // pantalla inicial: sale de la app
});
// Encabezado: si las pestañas no entran en una línea junto al escudo y la hora, pasan abajo.
function fitHeader(){
  const bar=document.querySelector('.bar'),t=document.querySelector('.tabs');if(!bar||!t)return;
  bar.classList.remove('stack');
  if(window.innerWidth<=700||t.scrollWidth>t.clientWidth+2)bar.classList.add('stack');
}
window.addEventListener('resize',fitHeader);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitHeader);
/* ---------- arranque ---------- */
const DL=true;
// En el celular se recuerda quién es: en Guardia y Alertas va directo al PIN.
function prefillYo(){const yo=LS.get('bviv_yo'),s=sess();if(!isKiosk()&&yo&&member(yo)&&s&&s.step==='who'&&['guardia','alertas'].includes(S.tab)){s.who=yo;s.step='pin';s.pin=''}}
// El service worker avisa cuando llega una alerta con la app abierta.
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{const d=e.data||{};
  if(d.tipo==='alerta')loadPublic().then(()=>{if(S.tab==='alertas'&&isLogged())reload()});
  if(d.tipo==='abrir'&&d.tab==='alertas'&&S.tab!=='alertas')goAlertas();});
if('serviceWorker' in navigator){
  const habiaSW=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(r=>{setInterval(()=>r.update().catch(()=>{}),30*60*1000)}).catch(()=>{});
  // Versión nueva instalada: se recarga sola apenas nadie tenga una sesión abierta.
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!habiaSW)return;if(!isLogged())location.reload();else{S.recargar=true;toast('Hay una versión nueva de la app: se actualiza sola cuando salgas.')}});
}
(async()=>{
  render();
  await loadPublic();
  // En el celular se recuerda quién es: va directo al PIN.
  const yo=LS.get('bviv_yo');
  if(S.tab==='guardia'&&yo&&member(yo)){Object.assign(S.sess.guardia,{who:yo,step:'pin'})}
  armBack();
  // Abierta desde la notificación de una alerta
  if(new URLSearchParams(location.search).get('tab')==='alertas'){S.tab='alertas';prefillYo();history.replaceState(null,'',location.pathname)}
  render();
})();
tick();
setInterval(()=>{tick();liveTick();if(S.saver)renderSaver()},15000);
setInterval(async()=>{if(!S.busy&&isLogged()&&document.visibilityState!=='hidden'){const r=await rpc('publico').catch(()=>null);if(r){S.alertas=(r.alertas||[]).map(a=>({...a,fecha:loc(a.fecha)}));alertCheck()}}},30000);
setInterval(async()=>{if(S.tab==='sci'&&S.sciTab==='dot'&&isLogged()&&!S.busy&&!document.querySelector('input:focus,select:focus,textarea:focus')){await reload();return}if(!S.busy&&!isLogged()){await loadPublic();if(S.saver)renderSaver();else if(!document.querySelector('input:focus,select:focus,textarea:focus'))render()}},60000);
