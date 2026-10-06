/* =====================================================================
   TAREAS (reemplaza al bot de Telegram)
    · Guardia → Mis tareas: empezar, terminar (foto y nota opcionales), pedir tareas.
    · Panel → Tareas (superiores, jefatura y admin): Tablero con revisión, Asignar,
      Periódicas (semáforo por unidad) y Catálogo (tipos × unidades/sectores, frecuencia).
    · Asignan los superiores a su guardia; revisa otro superior de la misma guardia.
    · Las horas siguen siendo las de mantenimiento de guardia; la tarea suma en la calificación.
   ===================================================================== */
const TAR_EST = { pendiente: 'Por hacer', en_curso: 'En curso', revision: 'Para revisar', aprobada: 'Hecha', cancelada: 'Cancelada' };

/* ---------- datos ---------- */
const tarLoad = async () => { const r = await rpc('tareas_datos', { tok: tokNow() }); tarIdx(r); S.tar = r; };
function tarIdx(D){
  D.T = new Map(D.tipos.map(x => [x.id, x])); D.L = new Map(D.lugares.map(x => [x.id, x])); D.I = new Map(D.items.map(x => [x.id, x]));
}
async function tarDo(fn, args, msg){
  if(S.busy) return null; S.busy = true;
  try { const r = await call(fn, args); if(msg) toast(typeof msg === 'function' ? msg(r) : msg); await tarLoad(); return (r == null || r === '') ? true : r; }
  catch(e){ return null; }
  finally { S.busy = false; render(); }
}
function tarNeed(){
  if(S.tar != null) return false;
  if(!tarNeed.busy){ tarNeed.busy = true; tarLoad().catch(e => { toast(e.message); S.tar = false; }).finally(() => { tarNeed.busy = false; render(); }); }
  return true;
}
const tarRetry = '<div class="card"><p style="margin:0 0 8px">No se pudieron cargar las tareas.</p><button class="btn outline" id="tarretry">Reintentar</button></div>';
const tarItem = id => S.tar.I.get(id);
const tarTipo = it => S.tar.T.get(it.t) || { n: '?' };
const tarLugar = it => S.tar.L.get(it.l) || { n: '?' };
const tarDesc = id => { const it = tarItem(id); return it ? `${tarTipo(it).n} · ${tarLugar(it).n}` : 'Tarea'; };
const tarAtrasada = t => (t.e === 'pendiente' || t.e === 'en_curso') && t.pl && new Date(t.pl) < new Date();
const tarFecha = ts => { const l = loc(ts); return l ? ddmm(l) : ''; };
const tarAbierta = t => ['pendiente', 'en_curso', 'revision'].includes(t.e);
// Estado de una tarea periódica: días hasta que vence (negativo = vencida), o null si nunca se hizo.
function tarPer(it){
  if(!it.cada) return null;
  const ab = S.tar.tareas.filter(t => t.i === it.id && tarAbierta(t));
  if(ab.length) return { k: 'asig', txt: ab.map(t => split(t.n)[0].toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase())).join(', ') };
  if(!it.ultima) return { k: 'nunca' };
  const pasados = Math.floor((Date.now() - new Date(it.ultima)) / 864e5), resta = it.cada - pasados;
  if(resta < 0) return { k: 'venc', txt: `hace ${pasados} d`, resta };
  if(resta <= Math.min(7, Math.ceil(it.cada / 4))) return { k: 'prox', txt: resta === 0 ? 'vence hoy' : resta === 1 ? 'vence mañana' : `vence en ${resta} d`, resta };
  return { k: 'ok', txt: `hace ${pasados} d`, resta };
}
function tarPerHint(it){
  const s = tarPer(it); if(!s) return '';
  return { venc: `cada ${it.cada} d · vencida`, nunca: `cada ${it.cada} d · nunca hecha`, prox: `cada ${it.cada} d · ${s.txt}`, ok: `cada ${it.cada} d · al día`, asig: `cada ${it.cada} d · asignada` }[s.k];
}
const tarItemsVivos = () => S.tar.items.filter(it => it.activo && tarTipo(it).activo !== false && tarLugar(it).activo !== false);
// Alcance del panel: superiores, su guardia; jefatura y admin, la que elijan.
function tarGuardia(){ const D = S.tar; if(D.jefe) return S.tarG ?? 'all'; return String({ sup1: 1, sup2: 2, sup0: 0 }[D.rol] ?? D.g); }
const tarEnAlcance = t => { const g = tarGuardia(); return g === 'all' || String(t.g) === g; };
const tarPuedeRevisar = t => { const D = S.tar; return t.pid !== D.yo && t.porId !== D.yo && (D.jefe || D.rol === 'sup' + t.g); };
function tarAsignables(){
  const D = S.tar, g = tarGuardia();
  return active().filter(p => !p.cargo && (D.jefe ? (g === 'all' || String(p.g) === g) : D.rol === 'sup' + p.g)).sort((a, b) => a.n.localeCompare(b.n, 'es'));
}

/* ---------- cumplimiento (como en la calificación) ---------- */
function tarCumpl(pid){
  const anio = new Date().getFullYear(), s1 = new Date().getMonth() < 6, desde = `${anio}-${s1 ? '01-01' : '07-01'}`, hasta = `${anio}-${s1 ? '06-30' : '12-31'}`;
  const mias = S.tar.tareas.filter(t => t.pid === pid), en = d => d && d >= desde && d <= hasta, f = ts => loc(ts)?.slice(0, 10);
  const apr = mias.filter(t => !t.ped && t.e === 'aprobada' && en(f(t.pl))).length;
  const inc = mias.filter(t => !t.ped && tarAtrasada(t) && en(f(t.pl))).length;
  const ped = mias.filter(t => t.ped && t.e === 'aprobada' && en(f(t.fin))).length;
  const asig = apr + inc;
  if(!asig && !ped) return null;
  return { pct: asig ? Math.min(100, (apr + ped) / asig * 100) : 100, apr, asig, ped };
}

/* ---------- tarjeta de una tarea ---------- */
function tarCard(t, modo){
  const atr = tarAtrasada(t), cls = t.e === 'revision' ? 'rev' : t.e === 'aprobada' ? 'ok' : t.e === 'en_curso' ? 'cur' : atr ? 'atr' : t.urg ? 'urg' : '';
  const pills = [t.urg && tarAbierta(t) ? '<span class="pill red">Urgente</span>' : '', atr ? '<span class="pill orange">Atrasada</span>' : '',
    t.e === 'en_curso' ? '<span class="pill blue">En curso</span>' : '', t.e === 'revision' && modo === 'mia' ? '<span class="pill yellow">Para revisar</span>' : '',
    t.e === 'aprobada' ? '<span class="pill green">Hecha</span>' : '', t.ped ? '<span class="pill">Pedida</span>' : ''].join('');
  const it = tarItem(t.i) || { t: 0, l: 0 };
  const quien = modo === 'mia' ? (t.ped ? 'Te la anotaste vos' : `Asignó ${esc(nice(t.por || ''))}`) : `${esc(nice(t.n))}${t.ped ? ' · se la anotó' : t.por ? ' · asignó ' + esc(nice(t.por)) : ''}`;
  let acc = '';
  if(modo === 'mia'){
    if(t.e === 'pendiente') acc = `<div class="row" style="gap:8px"><button class="btn primary" style="flex:1" data-tarini="${t.id}">Empezar</button><button class="btn outline" data-tarfin="${t.id}">Ya la hice</button></div>`;
    if(t.e === 'en_curso') acc = `<button class="btn go big" style="margin-top:10px;padding:14px" data-tarfin="${t.id}">Terminar</button>`;
    if(t.ped && (t.e === 'pendiente' || t.e === 'en_curso')) acc += `<button class="linkbtn" id="tarcan${t.id}" data-tarcan="${t.id}">Dejarla</button>`;
  } else if(modo === 'rev'){
    acc = `${t.foto ? (S.tarFotos?.[t.id] ? `<img class="tfoto" src="${esc(S.tarFotos[t.id])}" alt="Foto de la tarea">` : `<button class="btn small outline" data-tarfoto="${t.id}">Ver foto</button>`) : '<span class="meta">Sin foto</span>'}
      ${t.nota ? `<p class="tnota">“${esc(t.nota)}”</p>` : ''}
      ${tarPuedeRevisar(t) ? (S.tarDev === t.id ? `<div class="field"><label class="label" for="tdev">Qué falta</label><input id="tdev" placeholder="Ej.: faltan los asientos" maxlength="300"></div>
          <div class="row" style="gap:6px;margin-top:8px"><button class="btn small primary" data-tardevok="${t.id}">Devolver</button><button class="btn small" id="tardevno">Cancelar</button></div>`
        : `<div class="row" style="gap:6px;margin-top:8px"><button class="btn small go" data-tarok="${t.id}">Aprobar</button><button class="btn small outline" data-tardev="${t.id}">Devolver</button></div>`)
        : `<p class="demo" style="margin:6px 0 0">${t.porId === S.tar.yo ? 'La asignaste vos: la revisa otro superior de la guardia.' : t.pid === S.tar.yo ? 'Es tuya: la revisa otro superior.' : 'La revisa un superior de esa guardia.'}</p>`}`;
  } else if(modo === 'tab' && tarAbierta(t)){
    acc = `<button class="linkbtn" id="tarcan${t.id}" data-tarcan="${t.id}">Cancelar</button>`;
  }
  const sub = modo === 'mia' && t.e === 'revision' ? `Terminada ${tarFecha(t.fin)} · la revisa un superior de tu guardia.`
    : modo === 'tab' && t.e === 'en_curso' && t.ini ? `desde ${fmtD(loc(t.ini)).slice(6)}` : modo === 'tab' && t.e === 'aprobada' && t.rev ? `aprobó ${esc(nice(t.rev))}` : '';
  return `<div class="tcard ${cls}">${pills ? `<div class="tpills">${pills}</div>` : ''}
    <div class="tt">${esc(tarTipo(it).n)}</div><div class="tu">${esc(tarLugar(it).n)}</div>
    <div class="meta">${quien}${tarAbierta(t) && modo !== 'mia' ? ` · hasta ${tarFecha(t.pl)}` : ''}${sub ? ' · ' + sub : ''}</div>
    ${t.com && t.e === 'pendiente' ? `<div class="tdevuelta"><b>Devuelta:</b> ${esc(t.com)}</div>` : ''}${acc}</div>`;
}

/* ---------- Guardia → Mis tareas ---------- */
function vMisTareas(b){
  if(tarNeed()) return '<p class="lead">Cargando…</p>';
  if(S.tar === false) return tarRetry;
  const D = S.tar, p = member(b), head = t => `<div class="who"><div><span class="label">${p.g ? 'Guardia ' + p.g : 'Sin guardia'} · ${esc(p.cat)}</span><h2>${t}</h2></div><button class="btn outline small" ${S.tarFin ? 'id="tarfinno"' : 'data-mode=""'}>Volver</button></div>`;
  if(S.tarFin) return head('Terminar tarea') + vTarTerminar();
  const mias = D.tareas.filter(t => t.pid === D.yo);
  const hacer = mias.filter(t => t.e === 'pendiente' || t.e === 'en_curso').sort((a, b) => (b.urg - a.urg) || (tarAtrasada(b) - tarAtrasada(a)) || (a.e === 'en_curso' ? -1 : 0) || new Date(a.pl) - new Date(b.pl));
  const rev = mias.filter(t => t.e === 'revision'), hechas = mias.filter(t => t.e === 'aprobada').slice(0, 5);
  const C = tarCumpl(D.yo);
  const abiertasMias = new Set(mias.filter(tarAbierta).map(t => t.i));
  const vivos = tarItemsVivos().filter(it => !abiertasMias.has(it.id));
  const sug = vivos.map(it => ({ it, s: tarPer(it) })).filter(x => x.s && ['venc', 'nunca', 'prox'].includes(x.s.k)).sort((a, b) => (a.s.resta ?? -999) - (b.s.resta ?? -999)).slice(0, 6);
  const fila = it => `<li><span><b>${esc(tarTipo(it).n)}</b><br><span class="meta">${esc(tarLugar(it).n)}${it.cada ? ' · ' + tarPerHint(it) : ''}</span></span><button class="btn small outline" data-tarpedir="${it.id}">Me la anoto</button></li>`;
  let cat = '';
  if(S.tarCat){
    const porL = new Map(); for(const it of vivos){ const l = tarLugar(it); if(!porL.has(l.id)) porL.set(l.id, []); porL.get(l.id).push(it); }
    cat = [...porL.entries()].sort((a, b) => D.lugares.findIndex(x => x.id === a[0]) - D.lugares.findIndex(x => x.id === b[0]))
      .map(([lid, its]) => `<div class="section-h" style="margin:14px 0 4px"><span class="label">${esc(D.L.get(lid).n)}</span></div><ul class="list">${its.map(it => `<li><span>${esc(tarTipo(it).n)}${it.cada ? `<br><span class="meta">${tarPerHint(it)}</span>` : ''}</span><button class="btn small outline" data-tarpedir="${it.id}">Me la anoto</button></li>`).join('')}</ul>`).join('');
  }
  return head('Mis tareas') + `
  ${S.tarHecha ? `<div class="card hot" style="margin-bottom:14px"><h3>✓ Enviada a revisión</h3><p style="margin:0 0 8px">${esc(S.tarHecha)}. ${p.g ? '¿Querés cargar las horas de mantenimiento? Se abre la carga de siempre con la descripción completa.' : ''}</p>
    ${p.g ? '<button class="btn outline big" style="margin-top:4px" id="tarhoras">Cargar horas de mantenimiento</button>' : ''}<button class="linkbtn" style="display:block;margin-top:8px" id="tarhecha">Ahora no</button></div>` : ''}
  ${C ? `<div class="card" style="margin-bottom:14px"><div class="top"><h3 style="margin:0">Mi cumplimiento</h3><span class="pill ${C.pct >= 80 ? 'green' : C.pct >= 60 ? 'yellow' : 'red'}">${Math.round(C.pct)} %</span></div>
    <div class="prog"><i style="width:${Math.round(C.pct)}%;background:${calCol(C.pct)}"></i></div>
    <div class="meta">${C.apr} de ${C.asig} asignadas hechas en el semestre${C.ped ? ` · +${C.ped} pedida${C.ped > 1 ? 's' : ''} por iniciativa` : ''}. Suma en tu calificación.</div></div>` : ''}
  <div class="section-h" style="margin:8px 0"><h3 style="margin:0">Para hacer</h3><span class="demo">Hasta el miércoles 20:00</span></div>
  ${hacer.map(t => tarCard(t, 'mia')).join('') || '<div class="card off"><p style="margin:0">No tenés tareas pendientes. Podés pedir una abajo.</p></div>'}
  ${rev.length ? `<div class="section-h" style="margin:18px 0 8px"><h3 style="margin:0">En revisión</h3></div>${rev.map(t => tarCard(t, 'mia')).join('')}` : ''}
  <div class="section-h" style="margin:20px 0 8px"><h3 style="margin:0">Podés pedir</h3><span class="demo">Suman como iniciativa</span></div>
  <div class="card">${sug.length ? `<ul class="list">${sug.map(x => fila(x.it)).join('')}</ul>` : '<p class="meta" style="margin:0">No hay tareas periódicas vencidas ahora.</p>'}
    <button class="linkbtn" style="margin-top:8px" id="tarcat">${S.tarCat ? 'Ocultar el catálogo' : 'Ver todo el catálogo'}</button>${cat}</div>
  ${hechas.length ? `<div class="section-h" style="margin:20px 0 8px"><h3 style="margin:0">Últimas hechas</h3></div><div class="card"><ul class="list">${hechas.map(t => `<li><span>${esc(tarDesc(t.i))}</span><span class="meta mono">${tarFecha(t.revd || t.fin)}</span></li>`).join('')}</ul></div>` : ''}`;
}
function vTarTerminar(){
  const t = S.tar.tareas.find(x => x.id === S.tarFin.id); if(!t){ S.tarFin = null; return ''; }
  const f = S.tarFin.foto;
  return `${tarCard({ ...t, urg: false }, 'ver')}
  <div class="card">
    <span class="label">Foto (opcional)</span>
    ${f ? `<img class="tfoto" src="${esc(f)}" alt="Foto"><div class="row" style="gap:6px"><label class="btn small outline filebtn">Cambiar foto<input type="file" id="tarfile" accept="image/*" capture="environment"></label><button class="btn small" id="tarfotono">Quitar</button></div>`
      : `<label class="photo filebtn">📷 Sacar foto o elegir de la galería<input type="file" id="tarfile" accept="image/*" capture="environment"></label>`}
    <div class="field"><label class="label" for="tarnota">Nota (opcional)</label><textarea id="tarnota" rows="3" maxlength="500" placeholder="Ej.: falta reponer guantes de nitrilo">${esc(S.tarFin.nota || '')}</textarea></div>
    <button class="btn go big" id="tarfinok">Marcar como terminada</button>
    <p class="demo" style="margin:8px 0 0">Pasa a revisión. La aprueba un superior de tu guardia.</p></div>`;
}

/* ---------- Panel → Tareas ---------- */
function vTareasPanel(viewer){
  if(tarNeed()) return '<p class="lead">Cargando…</p>';
  if(S.tar === false) return tarRetry;
  const D = S.tar, tab = S.tarTab || 'tablero';
  const nRev = D.tareas.filter(t => t.e === 'revision' && tarEnAlcance(t) && tarPuedeRevisar(t)).length;
  const seg = `<div><div class="seg seg2" role="tablist">${[['tablero', 'Tablero' + (nRev ? ` (${nRev})` : '')], ['asignar', 'Asignar'], ['periodicas', 'Periódicas'], ['catalogo', 'Catálogo']]
    .map(([k, l]) => `<button data-tartab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div></div>`;
  const gsel = D.jefe && tab !== 'catalogo' ? `<div class="field" style="flex:0 1 220px"><label class="label" for="targ">Guardia</label><select id="targ">${[['all', 'Todas'], ['1', 'Guardia 1'], ['2', 'Guardia 2'], ['0', 'Sin guardia']].map(([v, t]) => `<option value="${v}" ${tarGuardia() === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`
    : tab !== 'catalogo' ? `<span class="pill">${tarGuardia() === '0' ? 'Sin guardia' : 'Guardia ' + tarGuardia()}</span>` : '';
  let body = '';
  if(tab === 'tablero') body = vTarTablero(gsel);
  else if(tab === 'asignar') body = vTarAsignar(gsel);
  else if(tab === 'periodicas') body = vTarPeriodicas();
  else body = vTarCatalogo();
  return seg + body;
}
function vTarTablero(gsel){
  const D = S.tar, uf = S.tarU || '';
  const ts = D.tareas.filter(t => tarEnAlcance(t) && (!uf || String(tarItem(t.i)?.l) === uf));
  const hace14 = Date.now() - 14 * 864e5;
  const cols = [['Por hacer', ts.filter(t => t.e === 'pendiente').sort((a, b) => (b.urg - a.urg) || (tarAtrasada(b) - tarAtrasada(a))), 'tab', ''],
    ['En curso', ts.filter(t => t.e === 'en_curso'), 'tab', ''], ['Para revisar', ts.filter(t => t.e === 'revision'), 'rev', 'revc'],
    ['Hechas', ts.filter(t => t.e === 'aprobada' && new Date(t.revd || t.fin) > hace14), 'tab', '']];
  const lugares = [...new Set(D.tareas.filter(tarEnAlcance).map(t => tarItem(t.i)?.l).filter(Boolean))].map(id => D.L.get(id)).filter(Boolean);
  return `<div class="filters">${gsel}<div class="field" style="flex:0 1 240px"><label class="label" for="taru">Unidad o sector</label><select id="taru"><option value="">Todas</option>${lugares.map(l => `<option value="${l.id}" ${String(l.id) === uf ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select></div>
    <button class="btn small outline" id="tarreload">Actualizar</button></div>
  <div class="kan">${cols.map(([t, list, modo, cls]) => `<div class="kcol ${cls}"><h3>${t} <span class="pill ${cls ? 'yellow' : ''}">${list.length}</span></h3>
    ${list.slice(0, t === 'Hechas' ? 8 : 60).map(x => tarCard(x, modo)).join('') || '<p class="meta" style="margin:4px">Nada.</p>'}</div>`).join('')}</div>
  <p class="demo" style="margin-top:12px">Al <b>devolver</b> se escribe qué falta y la tarea vuelve a "Por hacer" con ese comentario. Las hechas muestran las últimas dos semanas.</p>`;
}
function vTarAsignar(gsel){
  const D = S.tar, A = S.tarA || (S.tarA = { l: null, its: [], ps: [], urg: false });
  const vivos = tarItemsVivos(), lugares = D.lugares.filter(l => l.activo && vivos.some(it => it.l === l.id));
  if(!A.l && lugares.length) A.l = lugares[0].id;
  const its = vivos.filter(it => it.l === A.l).sort((a, b) => tarTipo(a).n.localeCompare(tarTipo(b).n, 'es'));
  const q = (S.tarQ || '').trim().toLowerCase(), gente = tarAsignables(), vis = gente.filter(p => !q || p.n.toLowerCase().includes(q) || A.ps.includes(p.id));
  const carga = new Map(); for(const t of D.tareas) if(tarAbierta(t)) carga.set(t.pid, (carga.get(t.pid) || 0) + 1);
  const chip = (attr, id, on, txt, sub, warn) => `<button class="chip sm ${warn ? 'venc' : ''}" ${attr}="${id}" aria-pressed="${on}">${txt}${sub ? `<span class="sub">${sub}</span>` : ''}</button>`;
  const selIts = A.its.map(id => tarDesc(id)), selPs = gente.filter(p => A.ps.includes(p.id));
  const grupo = c => lugares.filter(l => l.c === c).map(l => chip('data-tarl', l.id, l.id === A.l, esc(l.n), '', vivos.some(it => it.l === l.id && ['venc', 'nunca'].includes(tarPer(it)?.k)))).join('');
  return `<div class="filters">${gsel}</div>
  <div class="side">
  <div class="card"><h3>Nueva asignación</h3>
    <span class="label">1 · Unidad o sector</span>
    <div class="chips" style="margin-top:6px">${grupo('unidad')}</div><div class="chips" style="margin-top:6px">${grupo('sector')}</div>
    <span class="label" style="display:block;margin-top:16px">2 · Tareas de ${esc(D.L.get(A.l)?.n || '')}</span>
    <div class="chips" style="margin-top:6px">${its.map(it => { const s = tarPer(it); return chip('data-tari', it.id, A.its.includes(it.id), esc(tarTipo(it).n), it.cada ? tarPerHint(it) : '', s && ['venc', 'nunca'].includes(s.k)); }).join('') || '<span class="meta">No hay tareas en el catálogo para este lugar.</span>'}</div>
    ${A.its.length ? `<p class="demo" style="margin:8px 0 0">Elegidas: ${selIts.map(esc).join(' · ')}</p>` : ''}
    <span class="label" style="display:block;margin-top:16px">3 · Quiénes${D.jefe ? '' : ' · ' + (tarGuardia() === '0' ? 'sin guardia' : 'Guardia ' + tarGuardia())}</span>
    <input class="search" id="tarq" style="margin:6px 0 8px;max-width:320px;padding:9px 12px" placeholder="Buscar por apellido" value="${esc(S.tarQ || '')}" autocomplete="off">
    <div class="chips">${vis.map(p => chip('data-tarp', p.id, A.ps.includes(p.id), esc(p.n), carga.get(p.id) ? `${carga.get(p.id)} pendiente${carga.get(p.id) > 1 ? 's' : ''}` : '')).join('') || '<span class="meta">Nadie para asignar con este filtro.</span>'}</div>
    <div class="row" style="margin-top:16px;align-items:center;gap:14px"><span class="label">Urgente</span><span class="toggle"><button class="${A.urg ? 'on' : ''}" data-tarurg="1">Sí</button><button class="${A.urg ? '' : 'on'}" data-tarurg="0">No</button></span>
      <span class="label" style="margin-left:6px">Plazo</span><span class="pill">Fin de la semana · ${fmtD(loc(D.plazo)).replace(' ', ' ')}</span></div>
    <button class="btn primary big" id="tarasig" ${A.its.length && A.ps.length ? '' : 'disabled'}>Asignar</button>
  </div>
  <div><div class="summary"><span class="label" style="color:#ddd">Resumen</span>
    <p style="margin:6px 0 0;font-size:18px">${A.its.length && selPs.length ? `<b>${A.its.length} tarea${A.its.length > 1 ? 's' : ''}</b> para <b>${selPs.map(p => esc(nice(p.n))).join('</b>, <b>')}</b>.${A.urg ? '<br>Urgente.' : ''}` : 'Elegí el lugar, las tareas y las personas.'}</p>
    <p style="margin:10px 0 0;font-size:15px">Les llega un aviso al celular. La revisa cualquier superior de la guardia <b>menos vos</b>.</p></div>
    <div class="card" style="margin-top:16px"><h3>Carga de la semana</h3><ul class="list">${gente.map(p => [p, carga.get(p.id) || 0]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p, n]) => `<li><span>${esc(nice(p.n))}</span><span class="meta">${n} pendiente${n === 1 ? '' : 's'}</span></li>`).join('') || '<li class="empty">Sin personal.</li>'}</ul>
    <p class="demo" style="margin:6px 0 0">Para repartir parejo.</p></div></div>
  </div>`;
}
function vTarPeriodicas(){
  const D = S.tar, its = tarItemsVivos().filter(it => it.cada);
  if(!its.length) return '<div class="card"><p style="margin:0">Todavía no hay tareas con frecuencia. Se cargan en <b>Catálogo</b>: poné cada cuántos días hay que hacer la tarea en esa unidad.</p></div>';
  const tipos = [...new Set(its.map(it => it.t))].map(id => D.T.get(id)), lugares = D.lugares.filter(l => its.some(it => it.l === l.id));
  const st = its.map(tarPer), cnt = k => st.filter(s => s.k === k).length;
  const cell = it => { if(!it) return '<td class="na">—</td>'; const s = tarPer(it);
    const lab = { ok: 'Al día', prox: 'Por vencer', venc: 'Vencida', nunca: 'Nunca', asig: 'Asignada' }[s.k], cls = { ok: 'ok', prox: 'pr', venc: 've', nunca: 'nu', asig: 'as' }[s.k];
    return `<td class="${cls}"><button class="pgb" data-tarper="${it.id}" title="Asignar">${lab}${s.txt ? `<small>${esc(s.txt)}</small>` : ''}</button></td>`; };
  return `<div class="kpis"><div class="kpi"><div class="n">${cnt('venc')}</div><div class="k">vencidas</div></div><div class="kpi warn"><div class="n">${cnt('prox')}</div><div class="k">por vencer</div></div><div class="kpi"><div class="n">${cnt('nunca')}</div><div class="k">nunca hechas</div></div><div class="kpi"><div class="n">${cnt('asig')}</div><div class="k">asignadas ahora</div></div></div>
  <div class="tablewrap" style="padding:8px"><table class="pg"><thead><tr><th class="u">Unidad / sector</th>${tipos.map(t => `<th>${esc(t.n)}</th>`).join('')}</tr></thead>
  <tbody>${lugares.map(l => `<tr><th class="u">${esc(l.n)}</th>${tipos.map(t => cell(its.find(it => it.l === l.id && it.t === t.id))).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="leg"><span><i style="background:var(--green-soft);box-shadow:inset 0 0 0 1px var(--green)"></i>Al día</span><span><i style="background:var(--yellow)"></i>Por vencer</span><span><i style="background:var(--red)"></i>Vencida</span><span><i style="background:var(--ink)"></i>Nunca se hizo</span><span><i style="background:#dbe8f6"></i>Asignada ahora</span></div>
  <p class="demo">Tocá una casilla para asignarla (se abre Asignar con el lugar y la tarea elegidos). La "última vez" es del cuartel: cuenta sin importar qué guardia la hizo. Cuando una se vence, les llega <b>un</b> aviso a los superiores de la guardia en servicio.</p>`;
}
function vTarCatalogo(){
  const D = S.tar, L = D.lugares.filter(l => l.activo || S.tarVerQuitados), sel = S.tarCL && D.L.get(S.tarCL) ? S.tarCL : (L[0] || {}).id; S.tarCL = sel;
  const lg = D.L.get(sel), its = D.items.filter(it => it.l === sel && it.activo).sort((a, b) => tarTipo(a).n.localeCompare(tarTipo(b).n, 'es'));
  const usados = new Set(its.map(it => it.t)), libres = D.tipos.filter(t => t.activo && !usados.has(t.id));
  const lista = c => L.filter(l => l.c === c).map(l => `<button class="catl ${l.id === sel ? 'on' : ''} ${l.activo ? '' : 'off'}" data-tarcl="${l.id}">${esc(l.n)}<span>${D.items.filter(it => it.l === l.id && it.activo).length}</span></button>`).join('');
  return `<p class="lead">Las tareas se escriben una sola vez y se marcan en cada unidad o sector. La frecuencia es opcional: con ella la app avisa cuando se vence (por ejemplo, rotación de baterías cada 90 días).</p>
  <div class="catgrid">
    <div class="card"><h3>Unidades</h3><div class="catls">${lista('unidad')}</div>
      <h3 style="margin-top:16px">Sectores</h3><div class="catls">${lista('sector')}</div>
      <div class="field"><label class="label" for="tcl_n">Agregar</label><input id="tcl_n" placeholder="Ej.: Unidad 3 o Lavadero" maxlength="60"></div>
      <div class="row" style="gap:6px;margin-top:8px"><select id="tcl_c" style="flex:1"><option value="sector">Sector del cuartel</option><option value="unidad">Unidad (vehículo)</option></select><button class="btn small outline" id="tcladd">Agregar</button></div>
      <p class="demo" style="margin:8px 0 0">Las unidades de SCI → Configuración aparecen solas.</p></div>
    <div>${lg ? `<div class="card"><div class="top"><h3 style="margin:0">${esc(lg.n)}</h3><span class="row" style="gap:6px"><button class="btn small outline" id="tclren">Renombrar</button>${lg.activo ? `<button class="btn small" id="tcldel">Quitar</button>` : `<button class="btn small" id="tclrest">Restaurar</button>`}</span></div>
      ${S.tarRen === 'l' ? `<div class="row" style="gap:6px;margin:8px 0"><input id="tclren_n" value="${esc(lg.n)}" style="flex:1;padding:10px;border:2px solid var(--line);border-radius:8px"><button class="btn small primary" id="tclrenok">Guardar</button></div>` : ''}
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Tarea</th><th>Cada cuántos días</th><th></th></tr></thead><tbody>
      ${its.map(it => `<tr><td>${esc(tarTipo(it).n)}</td><td><input class="tin" type="number" min="1" max="730" data-tarcada="${it.id}" value="${it.cada ?? ''}" placeholder="sin frecuencia" style="max-width:150px"></td><td style="text-align:right"><button class="btn small" id="tidel${it.id}" data-tidel="${it.id}">Quitar</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin tareas en este lugar.</td></tr>'}</tbody></table></div>
      <div class="row" style="gap:8px;margin-top:12px;align-items:end"><div class="field" style="flex:2 1 220px;margin:0"><label class="label" for="ti_t">Agregar tarea</label><select id="ti_t"><option value="">Elegir del catálogo…</option>${libres.map(t => `<option value="${t.id}">${esc(t.n)}</option>`).join('')}<option value="nueva">+ Nueva tarea…</option></select></div>
        <div class="field" style="flex:0 1 130px;margin:0"><label class="label" for="ti_c">Cada (días)</label><input id="ti_c" type="number" min="1" max="730" placeholder="opcional"></div>
        <button class="btn outline" id="tiadd">Agregar</button></div>
      <div class="field" id="ti_nbox" ${S.tarNueva ? '' : 'hidden'}><label class="label" for="ti_n">Nombre de la tarea nueva</label><input id="ti_n" placeholder="Ej.: Lavado de mangueras" maxlength="100"></div></div>` : ''}
    <div class="card" style="margin-top:16px"><div class="top"><h3 style="margin:0">Todas las tareas</h3><button class="linkbtn" id="tartipos">${S.tarTipos ? 'Ocultar' : 'Renombrar o quitar'}</button></div>
      ${S.tarTipos ? `<ul class="list">${D.tipos.filter(t => t.activo || S.tarVerQuitados).map(t => `<li><input class="tin" data-tartipo="${t.id}" value="${esc(t.n)}" style="flex:1" ${t.activo ? '' : 'disabled'}><span class="row" style="gap:6px"><span class="meta">${D.items.filter(it => it.t === t.id && it.activo).length} lugares</span>${t.activo ? `<button class="btn small" id="ttdel${t.id}" data-ttdel="${t.id}">Quitar</button>` : `<button class="btn small" data-ttrest="${t.id}">Restaurar</button>`}</span></li>`).join('')}</ul>
        <p class="demo" style="margin:8px 0 0">El nombre se guarda al salir del campo. Al quitar una tarea deja de ofrecerse en todos los lugares; lo ya hecho queda en el historial.</p>
        <label class="check"><input type="checkbox" id="tarquit" ${S.tarVerQuitados ? 'checked' : ''}> Mostrar quitados</label>`
      : `<p class="meta" style="margin:6px 0 0">${D.tipos.filter(t => t.activo).map(t => esc(t.n)).join(' · ')}</p>`}</div></div>
  </div>`;
}

/* ---------- acciones ---------- */
const tarEn = () => (S.tab === 'panel' && S.ptab === 'tareas') || (S.tab === 'guardia' && S.mode === 'tareas');
async function tareasAction(t){
  if(!tarEn()) return false;
  const d = t.dataset, D = S.tar;
  if(t.id === 'tarretry'){ S.tar = null; render(); return true; }
  if(t.id === 'tarreload'){ S.tar = null; render(); return true; }
  if(d.tartab){ S.tarTab = d.tartab; S.tarDev = null; S.tarRen = null; render(); return true; }
  // bombero
  if(d.tarini){ await tarDo('tarea_empezar', { tid: +d.tarini }, 'Arrancaste. Cuando termines, tocá Terminar.'); return true; }
  if(d.tarfin){ S.tarFin = { id: +d.tarfin, foto: null, nota: '' }; S.tarHecha = null; render(); window.scrollTo(0, 0); return true; }
  if(t.id === 'tarfinno'){ S.tarFin = null; render(); return true; }
  if(t.id === 'tarfotono'){ S.tarFin.nota = $('#tarnota')?.value || ''; S.tarFin.foto = null; render(); return true; }
  if(t.id === 'tarfinok'){
    const F = S.tarFin, desc = tarDesc(D.tareas.find(x => x.id === F.id)?.i);
    if(await tarDo('tarea_terminar', { tid: F.id, foto: F.foto || null, nota: $('#tarnota').value || null }, 'Terminada. Quedó para revisión.')){ S.tarFin = null; S.tarHecha = desc; render(); window.scrollTo(0, 0); }
    return true;
  }
  if(t.id === 'tarhecha'){ S.tarHecha = null; render(); return true; }
  if(t.id === 'tarhoras'){ S.actPrefill = 'Tarea: ' + S.tarHecha; S.tarHecha = null; S.mode = 'mant'; render(); window.scrollTo(0, 0); return true; }
  if(d.tarpedir){ await tarDo('tarea_pedir', { item: +d.tarpedir }, 'Te la anotaste. Está en "Para hacer".'); window.scrollTo(0, 0); return true; }
  if(t.id === 'tarcat'){ S.tarCat = !S.tarCat; render(); return true; }
  if(d.tarcan){ if(!confirmTwice(t, 'Tocá de nuevo para cancelarla.')) return true; await tarDo('tarea_cancelar', { tid: +d.tarcan }, 'Tarea cancelada.'); return true; }
  // revisión
  if(d.tarfoto){ try { const f = await call('tarea_foto', { tid: +d.tarfoto }); S.tarFotos = { ...(S.tarFotos || {}), [d.tarfoto]: f }; render(); } catch(e){} return true; }
  if(d.tarok){ await tarDo('tarea_revisar', { tid: +d.tarok, aprobar: true, comentario: null }, 'Aprobada.'); return true; }
  if(d.tardev){ S.tarDev = +d.tardev; render(); $('#tdev')?.focus(); return true; }
  if(t.id === 'tardevno'){ S.tarDev = null; render(); return true; }
  if(d.tardevok){ const c = $('#tdev').value.trim(); if(c.length < 3){ toast('Escribí qué falta para que la corrija.'); return true; }
    if(await tarDo('tarea_revisar', { tid: +d.tardevok, aprobar: false, comentario: c }, 'Devuelta con tu comentario.')){ S.tarDev = null; render(); } return true; }
  // asignar
  const A = S.tarA;
  if(d.tarl){ A.l = +d.tarl; A.its = []; render(); return true; }
  if(d.tari){ const id = +d.tari; A.its = A.its.includes(id) ? A.its.filter(x => x !== id) : [...A.its, id]; render(); return true; }
  if(d.tarp){ const id = +d.tarp; A.ps = A.ps.includes(id) ? A.ps.filter(x => x !== id) : [...A.ps, id]; render(); return true; }
  if(d.tarurg != null){ A.urg = d.tarurg === '1'; render(); return true; }
  if(t.id === 'tarasig'){
    const n = await tarDo('tareas_asignar', { items: A.its, personas: A.ps, urgente: A.urg }, r => +r ? `Listo: ${r} tarea${+r > 1 ? 's' : ''} asignada${+r > 1 ? 's' : ''}. Les llegó el aviso.` : 'Ya tenían esas tareas pendientes: no se repitieron.');
    if(n){ S.tarA = { l: A.l, its: [], ps: [], urg: false }; S.tarQ = ''; render(); }
    return true;
  }
  if(d.tarper){ const it = tarItem(+d.tarper); S.tarA = { l: it.l, its: [it.id], ps: [], urg: false }; S.tarTab = 'asignar'; render(); window.scrollTo(0, 0); return true; }
  // catálogo
  if(d.tarcl){ S.tarCL = +d.tarcl; S.tarRen = null; S.tarNueva = false; render(); return true; }
  if(t.id === 'tcladd'){ const n = $('#tcl_n').value.trim(); if(n.length < 2){ toast('Escribí el nombre.'); return true; }
    const id = await tarDo('tarea_lugar_guardar', { lid: null, nombre: n, clase: $('#tcl_c').value, activo: true }, `${n} agregado.`); if(id){ S.tarCL = +id; render(); } return true; }
  const lg = D && D.L.get(S.tarCL);
  if(t.id === 'tclren'){ S.tarRen = S.tarRen === 'l' ? null : 'l'; render(); return true; }
  if(t.id === 'tclrenok'){ if(await tarDo('tarea_lugar_guardar', { lid: lg.id, nombre: $('#tclren_n').value, clase: lg.c, activo: lg.activo }, 'Nombre guardado.')){ S.tarRen = null; render(); } return true; }
  if(t.id === 'tcldel'){ if(!confirmTwice(t, `Tocá de nuevo para quitar ${lg.n}. Lo ya hecho queda en el historial.`)) return true; await tarDo('tarea_lugar_guardar', { lid: lg.id, nombre: lg.n, clase: lg.c, activo: false }, `${lg.n} quitado.`); return true; }
  if(t.id === 'tclrest'){ await tarDo('tarea_lugar_guardar', { lid: lg.id, nombre: lg.n, clase: lg.c, activo: true }, `${lg.n} restaurado.`); return true; }
  if(t.id === 'tiadd'){
    let tipo = $('#ti_t').value; const cada = $('#ti_c').value ? +$('#ti_c').value : null;
    if(!tipo){ toast('Elegí la tarea.'); return true; }
    if(cada != null && !(cada >= 1 && cada <= 730)){ toast('La frecuencia va de 1 a 730 días.'); return true; }
    if(tipo === 'nueva'){ const n = $('#ti_n').value.trim(); if(n.length < 3){ toast('Escribí el nombre de la tarea nueva.'); return true; }
      try { tipo = await call('tarea_tipo_guardar', { tid: null, nombre: n, activo: true }); } catch(e){ return true; } }
    if(await tarDo('tarea_item_guardar', { tipo: +tipo, lugar: lg.id, aplica: true, cada }, 'Tarea agregada.')){ S.tarNueva = false; render(); }
    return true;
  }
  if(d.tidel){ if(!confirmTwice(t, 'Tocá de nuevo para quitarla de este lugar.')) return true; const it = tarItem(+d.tidel); await tarDo('tarea_item_guardar', { tipo: it.t, lugar: it.l, aplica: false, cada: null }, 'Quitada.'); return true; }
  if(t.id === 'tartipos'){ S.tarTipos = !S.tarTipos; render(); return true; }
  if(d.ttdel){ if(!confirmTwice(t, 'Tocá de nuevo: deja de ofrecerse en todos los lugares.')) return true; const x = D.T.get(+d.ttdel); await tarDo('tarea_tipo_guardar', { tid: x.id, nombre: x.n, activo: false }, 'Tarea quitada del catálogo.'); return true; }
  if(d.ttrest){ const x = D.T.get(+d.ttrest); await tarDo('tarea_tipo_guardar', { tid: x.id, nombre: x.n, activo: true }, 'Tarea restaurada.'); return true; }
  return false;
}
function tareasChange(e){
  if(!tarEn()) return false;
  const t = e.target, d = t.dataset;
  if(t.id === 'targ'){ S.tarG = t.value; if(S.tarA) S.tarA.ps = []; render(); return true; }
  if(t.id === 'taru'){ S.tarU = t.value; render(); return true; }
  if(t.id === 'tarq'){ S.tarQ = t.value; render(); return true; }
  if(t.id === 'tarquit'){ S.tarVerQuitados = t.checked; render(); return true; }
  if(t.id === 'ti_t'){ S.tarNueva = t.value === 'nueva'; const b = $('#ti_nbox'); if(b) b.hidden = !S.tarNueva; return true; }
  if(d.tarcada){ const it = tarItem(+d.tarcada), v = t.value === '' ? null : +t.value;
    if(v != null && !(v >= 1 && v <= 730)){ toast('La frecuencia va de 1 a 730 días.'); return true; }
    tarDo('tarea_item_guardar', { tipo: it.t, lugar: it.l, aplica: true, cada: v }, v ? `Frecuencia: cada ${v} días.` : 'Sin frecuencia.'); return true; }
  if(d.tartipo){ const x = S.tar.T.get(+d.tartipo), n = t.value.trim(); if(!n || n === x.n) return true;
    tarDo('tarea_tipo_guardar', { tid: x.id, nombre: n, activo: true }, 'Nombre guardado.'); return true; }
  if(t.id === 'tarfile' && t.files && t.files.length){
    const nota = $('#tarnota')?.value || '';
    toast('Preparando foto…');
    comprimirImagen(t.files[0], 1000).then(async data => {
      let q = data;
      if(q.length > 440000){ const img = new Image(); img.src = q; await img.decode(); const c = document.createElement('canvas'), s = Math.sqrt(440000 / q.length);
        c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); q = c.toDataURL('image/jpeg', 0.6); }
      S.tarFin.foto = q; S.tarFin.nota = nota; render();
    }).catch(err => toast(err.message));
    return true;
  }
  return false;
}
