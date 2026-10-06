/* =====================================================================
   CALIFICACIÓN ANUAL · Decreto 957/04 (Ley 8058), inciso D
    · Asistencia (0 a 5): la calcula la app con cinco partes y sus pesos (editables por jefatura):
      guardias, capacitación y mantenimiento de guardia, asistencia general,
      novedades con asistencia (convocatorias) y alertas.
    · Vocación, capacidad técnico-profesional y cualidades personales (0 a 5): las marca la junta.
    · Oficiales: competencia funcional, labor administrativa y concepto general.
    · Concepto: 19-20 Excelente · 16-18 Muy bueno · 10-15 Bueno · 0-9 Insuficiente.
   ===================================================================== */
const CAL_PER = { s1: ['1.er semestre', '01-01', '06-30'], s2: ['2.º semestre', '07-01', '12-31'], anio: ['Año completo', '01-01', '12-31'] };
const CAL_COMP = [['guardias', 'Guardias'], ['gm', 'Capacitación y mantenimiento de guardia'], ['ag', 'Asistencia general'], ['novedades', 'Novedades con asistencia'], ['alertas', 'Alertas']];
const CAL_ESC = [[100, 5], [80, 4], [60, 3], [40, 2], [25, 1], [0, 0]];
const CAL_APREC = ['Excelente', 'Muy bueno', 'Bueno', 'Regular', 'Insuficiente'];
const CAL_OF = [['comp', 'Competencia funcional y de gobierno'], ['adm', 'Labor administrativa'], ['gen', 'Concepto general']];
const GRADOS_OF = ['of_ayte', 'of_subinsp', 'of_insp', 'of_ppal', 'subcrio', 'crio', 'crio_insp', 'crio_mayor', 'crio_gral'];
const calPts = pct => { const p = Math.round(pct); for(const [m, v] of CAL_ESC) if(p >= m) return v; return 0; };
const calConcepto = t => t >= 19 ? 'Excelente' : t >= 16 ? 'Muy bueno' : t >= 10 ? 'Bueno' : 'Insuficiente';
const calCptCls = c => ({ Excelente: 'c-ex', 'Muy bueno': 'c-mb', Bueno: 'c-b', Insuficiente: 'c-i' })[c] || '';
const calCol = p => p >= 80 ? 'var(--green)' : p >= 60 ? '#f08a24' : 'var(--red)';
const calPerDefault = () => new Date().getMonth() < 6 ? 's1' : 's2';
function calRango(anio, per){ const [l, a, b] = CAL_PER[per]; return { desde: `${anio}-${a}`, hasta: `${anio}-${b}`, label: l, factor: per === 'anio' ? 2 : 1, per, anio }; }
const calCfg = () => (S.calD && S.calD.cfg) || { metas: { ag: 60, gm: 20 }, pesos: { guardias: 1, gm: 1, ag: 1, novedades: 2, alertas: 2 } };
const esOficial = n => GRADOS_OF.includes((S.jer || {})[n]);
const calSujetos = () => active().filter(p => !p.cargo).sort((a, b) => (a.g || 9) - (b.g || 9) || a.n.localeCompare(b.n, 'es'));

async function calLoad(anio){
  const tok = tokNow(); if(!tok) return;
  try { S.calD = await rpc('calif_datos', { tok, desde: `${anio}-01-01`, hasta: `${anio}-12-31` }); S.calAnio = anio; }
  catch(e){ toast(e.message); }
}

/* ---------- cálculo de la asistencia de una persona en un período ---------- */
function calAsistencia(b, R){
  const p = member(b), D = S.calD || { novedades: [], alertas: [] }, cfg = calCfg(), M = cfg.metas, W = cfg.pesos;
  const conGuardia = p && (p.g === 1 || p.g === 2) && !p.cargo, c = {};
  const finR = R.hasta < dstr(new Date()) ? R.hasta : dstr(new Date());
  const enR = s => s && s.slice(0, 10) >= R.desde && s.slice(0, 10) <= R.hasta;
  // 1) guardias: noches cumplidas (propias + reemplazos) sobre noches asignadas
  if(conGuardia){
    let asign = 0, pres = 0, reps = 0;
    const fin = lastDueNight() < R.hasta ? lastDueNight() : R.hasta;
    for(let n = R.desde > START_NIGHT ? R.desde : START_NIGHT; n <= fin; n = addDays(n, 1)){
      const s = statusOf(b, n);
      if(['completa', 'parcial', 'ausente', 'sin'].includes(s.st)){ asign++; if(s.st === 'completa' || s.st === 'parcial') pres++; }
      else if(s.rep) reps++;
    }
    if(asign) c.guardias = { pct: Math.min(100, (pres + reps) / asign * 100), det: `${pres} de ${asign} noches asignadas${reps ? ` · ${reps} como reemplazo` : ''}` };
  }
  // 2) capacitación y mantenimiento de guardia (horas sobre la meta)
  if(conGuardia){
    const hs = S.horas.filter(h => h.b === b && h.f && MOTIVOS_GUARDIA.includes(h.m) && enR(h.i));
    const cap = hs.filter(h => h.m === CAP).reduce((s, h) => s + hrs(h), 0), man = hs.filter(h => h.m === MANT).reduce((s, h) => s + hrs(h), 0);
    const meta = +M.gm * R.factor;
    c.gm = { pct: Math.min(100, (cap + man) / meta * 100), det: `${fmtH(cap + man)} h de ${meta} h (meta) · ${fmtH(cap)} h capacitación · ${fmtH(man)} h mantenimiento` };
  }
  // 3) asistencia general (horas aprobadas sobre la meta)
  {
    const hs = S.horas.filter(h => h.b === b && h.f && !MOTIVOS_GUARDIA.includes(h.m) && enR(h.i));
    const ok = hs.filter(h => !h.manual).reduce((s, h) => s + hrs(h), 0), rev = hs.filter(h => h.manual).reduce((s, h) => s + hrs(h), 0);
    const meta = +M.ag * R.factor;
    c.ag = { pct: Math.min(100, ok / meta * 100), det: `${fmtH(ok)} h de ${meta} h (meta)${rev ? ` · ${fmtH(rev)} h a revisar, todavía no cuentan` : ''}` };
  }
  // 4) novedades con asistencia y 5) alertas: presentes sobre convocadas
  for(const [k, lista, txt] of [['novedades', D.novedades, 'convocatorias'], ['alertas', D.alertas, 'alertas en apresto']]){
    const items = (lista || []).filter(x => x.f >= R.desde && x.f <= finR);
    if(!items.length) continue;
    const esta = x => Array.isArray(x.pres) ? x.pres.includes(p.id) : !!x.pres;
    const si = items.filter(esta).length, falta = items.filter(x => !esta(x));
    c[k] = { pct: si / items.length * 100, det: `${si} de ${items.length} ${txt}${falta.length && falta.length <= 3 ? ' · faltó: ' + falta.map(x => x.t).join(', ') : ''}` };
  }
  let sw = 0, sp = 0;
  for(const [k] of CAL_COMP) if(c[k] && +W[k] > 0){ sw += +W[k]; sp += +W[k] * c[k].pct; }
  const pct = sw ? sp / sw : 0;
  return { comps: c, pct, pts: calPts(pct) };
}
const calFila = (pid) => ((S.calD && S.calD.calif) || []).find(x => x.pid === pid) || {};
function calTip(A){
  if(A.pts >= 5) return '¡Vas al 100 %! Mantenelo hasta el final del período.';
  const peor = CAL_COMP.filter(([k]) => A.comps[k]).sort((a, b) => A.comps[a[0]].pct - A.comps[b[0]].pct)[0];
  if(!peor) return 'Todavía no hay registros en este período.';
  const k = peor[0], cfg = calCfg();
  const sug = { guardias: 'registrá todas tus noches de guardia antes de las 20:00 o dejá reemplazo',
    gm: 'cargá tus horas de capacitación y mantenimiento de guardia', ag: 'sumá horas de asistencia general en el cuartel',
    novedades: 'anotate y asistí a las convocatorias', alertas: 'ponete en apresto cuando haya una alerta' }[k];
  const sig = CAL_ESC.slice().reverse().find(([m, v]) => v === A.pts + 1);
  return `<b>Para llegar a ${A.pts + 1} punto${A.pts ? 's' : ''}</b> necesitás ${sig ? sig[0] : 100} % de cumplimiento. Lo que más te baja: <b>${peor[1].toLowerCase()}</b>: ${sug}.`;
}

/* ---------- vista del bombero ---------- */
function vMiCalif(b){
  const anio = new Date().getFullYear();
  if(!S.calD || S.calAnio !== anio){ calLoad(anio).then(render); return '<p class="lead">Cargando…</p>'; }
  const per = S.calPerMi || calPerDefault(), R = calRango(anio, per), A = calAsistencia(b, R), p = member(b);
  const sem = ['s1', 's2'].map(k => { const r = calRango(anio, k), x = calAsistencia(b, r), fut = r.desde > dstr(new Date());
    return `<button class="semc ${k === per ? 'cur' : ''}" data-calmi="${k}"><span class="label">${k === 's1' ? 'Enero – Junio' : 'Julio – Diciembre'}</span>
      <div class="pts" style="font-size:30px${fut ? ';color:#b7b0a9' : ''}">${fut ? '—' : Math.round(x.pct) + ' %'}</div><span class="meta">${fut ? 'Todavía no empezó' : x.pts + ' punto' + (x.pts === 1 ? '' : 's') + (r.hasta >= dstr(new Date()) ? ' · en curso' : ' · cerrado')}</span></button>`; }).join('');
  const fila = calFila(p.id), obs = (S.calD.observados || []).includes(p.id);
  const junta = fila.estado === 'cerrada'
    ? `<div class="card" style="margin-top:16px"><h3>Calificación ${anio}</h3><div class="row" style="align-items:center;gap:12px"><span class="pts">${fila.total}<span style="font-size:20px;color:var(--muted)"> / 20</span></span><span class="cpt ${calCptCls(fila.concepto)}">${fila.concepto}</span></div>
       <ul class="list" style="margin-top:8px"><li><span>Asistencia</span><b>${fila.ovr ?? fila.pts}</b></li><li><span>Vocación</span><b>${fila.voc ?? '—'}</b></li><li><span>Capacidad técnico-profesional</span><b>${fila.cap ?? '—'}</b></li><li><span>Cualidades personales</span><b>${fila.cua ?? '—'}</b></li></ul></div>`
    : `<div class="card off" style="margin-top:16px"><h3>Calificación de la junta</h3><p style="margin:0">Vocación, capacidad técnico-profesional y cualidades personales las califica la junta a fin de año. El resultado aparece acá cuando se cierra.</p></div>`;
  return `<div class="who"><div><span class="label">${esc(nice(b))} · ${p.cargo ? esc(p.cargo) : p.g ? 'Guardia ' + p.g : 'Sin guardia'}</span><h2>Mi calificación ${anio}</h2></div><button class="btn outline small" data-mode="">Volver</button></div>
  ${obs ? '<div class="card alert" style="margin-bottom:14px"><b>Estás en categoría de observado</b> por la calificación del año pasado. Este año necesitás llegar al menos a "Bueno".</div>' : ''}
  <div class="m-hero"><div class="card"><h3>Asistencia · ${R.label}</h3><div class="big"><div class="ring" style="--p:${Math.round(A.pct)};--c:${calCol(A.pct)}"><div><span><b>${Math.round(A.pct)}%</b><br><small>cumplimiento</small></span></div></div>
    <div><span class="label">Puntaje de asistencia</span><div class="pts">${A.pts} <span style="font-size:20px;color:var(--muted)">/ 5</span></div>
    <div class="scale">${[0, 1, 2, 3, 4, 5].map(v => `<span class="${v === A.pts ? 'on' : ''}">${v}</span>`).join('')}</div>
    <p class="demo" style="margin:8px 0 0">100 % = 5 · 80 a 99 % = 4 · 60 a 79 % = 3 · 40 a 59 % = 2 · 25 a 39 % = 1 (Decreto 957/04)</p></div></div>
    <div class="tip" style="margin-top:14px">${calTip(A)}</div></div>
   <div class="card"><h3>Detalle</h3><div class="comp">${calComps(A)}</div></div></div>
  <div class="section-h"><h3 style="margin:0">Por semestre</h3><span class="demo">Tocá un semestre para ver su detalle</span></div><div class="sem">${sem}</div>${junta}`;
}
function calComps(A){
  const W = calCfg().pesos;
  return CAL_COMP.map(([k, n]) => { const x = A.comps[k];
    if(!x) return `<div class="ci"><b>${n}</b><span class="v" style="color:var(--muted)">—</span><div class="det">No corresponde en este período</div></div>`;
    const pc = Math.round(x.pct);
    return `<div class="ci"><b>${n} <span class="meta">· peso ${W[k]}</span></b><span class="v">${pc} %</span><div class="bar2"><i style="width:${pc}%;background:${calCol(pc)}"></i></div><div class="det">${esc(x.det)}</div></div>`; }).join('');
}

/* ---------- panel de jefatura (junta calificadora) ---------- */
function vCalifPanel(viewer){
  const anio = S.calAnioSel || new Date().getFullYear();
  if(!S.calD || S.calAnio !== anio){ calLoad(anio).then(render); return '<p class="lead">Cargando…</p>'; }
  const per = S.calPer || 'anio', R = calRango(anio, per), anual = per === 'anio', cfg = calCfg();
  const ppl = calSujetos(), obs = S.calD.observados || [];
  const filas = ppl.map(p => { const A = calAsistencia(p.n, R), f = calFila(p.id), ap = f.ovr ?? A.pts;
    const tot = (f.voc != null && f.cap != null && f.cua != null) ? ap + f.voc + f.cap + f.cua : null;
    return { p, A, f, ap, tot, cerrada: f.estado === 'cerrada' }; });
  const cerrada = filas.some(x => x.cerrada);
  const sel = (r, k) => { const v = r.f[k]; return `<span class="sel5">${[0, 1, 2, 3, 4, 5].map(i => r.cerrada ? `<span class="${v === i ? 'on' : ''}">${i}</span>` : `<button class="${v === i ? 'on' : ''}" data-calv="${r.p.id}|${k}|${i}">${i}</button>`).join('')}</span>`; };
  const cnt = c => filas.filter(r => r.tot != null && calConcepto(r.tot) === c).length, falt = filas.filter(r => r.tot == null).length;
  const head = `<div class="filters"><div class="field"><label class="label" for="cal_anio">Año</label><select id="cal_anio">${[anio + (anio < new Date().getFullYear() ? 1 : 0), anio, anio - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 2026).map(v => `<option ${v === anio ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="seg seg2" role="tablist" style="margin:0">${Object.entries(CAL_PER).map(([k, [l]]) => `<button data-calper="${k}" aria-selected="${per === k}">${l}</button>`).join('')}</div>
    <button class="btn small outline" id="calcfg">${S.calCfgOpen ? 'Cerrar metas y pesos' : 'Metas y pesos'}</button></div>`;
  const cfgCard = S.calCfgOpen ? `<div class="card" style="margin-bottom:16px"><div class="top"><h3>Metas y pesos</h3><span class="pill">Jefatura y administradores</span></div>
    <div class="row"><div class="field"><label class="label" for="cm_ag">Asistencia general (h por semestre)</label><input id="cm_ag" type="number" min="1" value="${cfg.metas.ag}"></div>
    <div class="field"><label class="label" for="cm_gm">Cap. y mant. de guardia (h por semestre)</label><input id="cm_gm" type="number" min="1" value="${cfg.metas.gm}"></div></div>
    <span class="label" style="display:block;margin-top:12px">Peso de cada parte en el porcentaje de asistencia</span>
    <div class="row">${CAL_COMP.map(([k, n]) => `<div class="field"><label class="label" for="cw_${k}">${n}</label><input id="cw_${k}" type="number" min="0" max="10" value="${cfg.pesos[k]}"></div>`).join('')}</div>
    <p class="demo" style="margin:8px 0 0">Las guardias, alertas y novedades se miden contra lo asignado o convocado. Las horas, contra la meta (en el año completo, la meta se duplica). Peso 0 = no cuenta. Al guardar, todos los porcentajes se recalculan y el cambio queda en el historial.</p>
    <button class="btn primary" style="margin-top:12px" id="calcfgsave">Guardar metas y pesos</button></div>` : '';
  const kpis = anual ? `<div class="kpis"><div class="kpi"><div class="n">${filas.length}</div><div class="k">a calificar (sin Jefe ni Sub Jefe)</div></div><div class="kpi"><div class="n">${cnt('Excelente')}</div><div class="k">Excelente</div></div><div class="kpi"><div class="n">${cnt('Muy bueno')}</div><div class="k">Muy bueno</div></div><div class="kpi"><div class="n">${cnt('Bueno')}</div><div class="k">Bueno</div></div><div class="kpi warn"><div class="n">${cnt('Insuficiente')}</div><div class="k">Insuficiente → quedan observados</div></div>${falt ? `<div class="kpi warn"><div class="n">${falt}</div><div class="k">faltan rubros de la junta</div></div>` : ''}</div>` : '';
  const nombre = r => { const g = gradoDe(r.p.n); return `<b>${esc(r.p.n)}</b><br><span class="meta">${g ? esc(g.a) + ' · ' : ''}${r.p.g ? 'G' + r.p.g : 'Sin guardia'}${r.p.cat === 'Aspirante' ? ' · Asp.' : ''}</span>${obs.includes(r.p.id) ? ' <span class="tag yellow">Observado</span>' : ''}`; };
  const asis = r => `<b>${Math.round(r.A.pct)} %</b><br><span class="meta">${r.f.ovr != null ? `<b style="color:var(--red-dark)">${r.f.ovr} pts · corregida</b>` : `${r.A.pts} pts · auto`}</span>`;
  let tabla;
  if(anual){
    tabla = `<div class="tablewrap"><table class="cal"><thead><tr><th>Bombero</th><th class="num">Asistencia</th><th>Vocación</th><th>Capacidad<br>técnico-prof.</th><th>Cualidades<br>personales</th><th class="num">Total</th><th>Concepto</th></tr></thead><tbody>
      ${filas.map(r => `<tr class="${S.calSel === r.p.id ? 'sel' : ''}"><td><button class="linkbtn" style="font-size:15px;padding:0;text-align:left" data-calsel="${r.p.id}">${nombre(r)}</button></td><td class="num">${asis(r)}</td><td>${sel(r, 'voc')}</td><td>${sel(r, 'cap')}</td><td>${sel(r, 'cua')}</td>
        <td class="num">${r.tot != null ? `<b style="font-size:20px">${r.tot}</b><span class="meta">/20</span>` : '<span class="meta">falta</span>'}</td><td>${r.tot != null ? `<span class="cpt ${calCptCls(calConcepto(r.tot))}">${calConcepto(r.tot)}</span>` : ''}</td></tr>
        ${S.calSel === r.p.id ? `<tr><td colspan="7" class="caldet">${vCalDetalle(r)}</td></tr>` : ''}`).join('')}</tbody></table></div>`;
  } else {
    tabla = `<div class="tablewrap"><table class="cal"><thead><tr><th>Bombero</th>${CAL_COMP.map(([k, n]) => `<th class="num">${n.replace('Capacitación y mantenimiento de guardia', 'Cap./mant. guardia').replace('Novedades con asistencia', 'Novedades')}</th>`).join('')}<th class="num">Asistencia</th></tr></thead><tbody>
      ${filas.map(r => `<tr><td>${nombre(r)}</td>${CAL_COMP.map(([k]) => { const x = r.A.comps[k]; return `<td class="num ${x ? (x.pct < 60 ? 'warn' : '') : 'zero'}">${x ? Math.round(x.pct) + ' %' : '—'}</td>`; }).join('')}<td class="num"><b>${Math.round(r.A.pct)} %</b> · ${r.A.pts} pts</td></tr>`).join('')}</tbody></table></div>`;
  }
  const botones = anual
    ? `<div class="row" style="margin-top:14px">${cerrada ? `<span class="pill green">Calificación ${anio} cerrada</span>${roleOf(viewer) === 'admin' ? `<button class="btn small" id="calreabrir">Reabrir</button>` : ''}` : `<button class="btn primary" id="calcerrar">Cerrar calificación ${anio}</button>`}<button class="btn outline" id="calpdf">${cerrada ? 'Acta para firmar (PDF)' : 'Borrador del acta (PDF)'}</button></div>
       <p class="demo" style="margin:8px 0 0">Asistencia: la calcula la app. Si la junta la corrige (en el detalle de cada bombero), se pide el motivo y queda en el acta. Al cerrar se guarda todo, se marcan los observados y se publica la mención de los mayores puntajes por 30 días. El Jefe y el Sub Jefe no figuran: los califican la Comisión Directiva y su mesa.</p>`
    : `<div class="row" style="margin-top:14px"><button class="btn outline" id="calpdf">Control semestral (PDF)</button></div><p class="demo" style="margin:8px 0 0">Control de mitad de año: solo la asistencia. En amarillo, las partes por debajo del 60 %.</p>`;
  return head + cfgCard + kpis + tabla + botones;
}
function vCalDetalle(r){
  const of = esOficial(r.p.n), dis = r.cerrada ? 'disabled' : '';
  return `<div class="grid2"><div><span class="label">Asistencia del año</span><div class="comp" style="margin-top:6px">${calComps(r.A)}</div></div>
    <div><span class="label">Corregir la asistencia (opcional)</span>
      <div class="row"><div class="field"><label class="label" for="co_pts">Puntos</label><select id="co_pts" ${dis}><option value="">Usar la calculada (${r.A.pts})</option>${[0, 1, 2, 3, 4, 5].map(v => `<option ${r.f.ovr === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field" style="flex:2 1 200px"><label class="label" for="co_mot">Motivo</label><input id="co_mot" value="${esc(r.f.ovrMot || '')}" placeholder="Ej.: licencia por trabajo de marzo a mayo" ${dis}></div></div>
      ${r.cerrada ? '' : `<button class="btn small outline" style="margin-top:8px" data-calovr="${r.p.id}">Guardar corrección</button>`}
      ${of ? `<span class="label" style="display:block;margin-top:16px">Calificación exclusiva para oficiales</span>
        ${CAL_OF.map(([k, n]) => `<div class="field"><label class="label" for="cof_${k}">${n}</label><select id="cof_${k}" data-calof="${r.p.id}|${k}" ${dis}><option value="">Elegir…</option>${CAL_APREC.map(v => `<option ${((r.f.of || {})[k]) === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')}` : ''}
    </div></div>`;
}

/* ---------- acciones ---------- */
async function calGuardar(pid, datos){
  try { await call('calif_guardar', { anio: S.calAnio, pid, datos });
    const L = S.calD.calif; let f = L.find(x => x.pid === pid); if(!f){ f = { pid }; L.push(f); }
    Object.assign(f, datos.of ? { of: { ...(f.of || {}), ...datos.of } } : datos); render(); return true; }
  catch(e){ return false; }
}
async function califAction(t){
  const d = t.dataset;
  if(d.calmi){ S.calPerMi = d.calmi; render(); return true; }
  if(d.calper){ S.calPer = d.calper; S.calSel = null; render(); return true; }
  if(t.id === 'calcfg'){ S.calCfgOpen = !S.calCfgOpen; render(); return true; }
  if(d.calsel){ S.calSel = S.calSel === +d.calsel ? null : +d.calsel; render(); return true; }
  if(d.calv){ const [pid, k, v] = d.calv.split('|'); await calGuardar(+pid, { [k]: +v }); return true; }
  if(d.calovr){ const v = $('#co_pts').value, m = $('#co_mot').value.trim();
    if(v !== '' && m.length < 3){ toast('Escribí el motivo de la corrección.'); return true; }
    if(await calGuardar(+d.calovr, { ovr: v === '' ? null : +v, ovrMot: m })) toast('Corrección guardada.'); return true; }
  if(t.id === 'calcfgsave'){
    const metas = { ag: +$('#cm_ag').value, gm: +$('#cm_gm').value }, pesos = {};
    for(const [k] of CAL_COMP) pesos[k] = Math.max(0, +$('#cw_' + k).value || 0);
    if(!(metas.ag > 0 && metas.gm > 0)){ toast('Las metas tienen que ser mayores a 0.'); return true; }
    if(!Object.values(pesos).some(v => v > 0)){ toast('Al menos una parte tiene que tener peso.'); return true; }
    try { await call('calif_metas', { valor: { metas, pesos } }); S.calD.cfg = { metas, pesos }; S.calCfgOpen = false; toast('Metas y pesos guardados. Los porcentajes se recalcularon.'); render(); } catch(e){}
    return true; }
  if(t.id === 'calcerrar'){
    const R = calRango(S.calAnio, 'anio'), ppl = calSujetos();
    const faltan = ppl.filter(p => { const f = calFila(p.id); return f.voc == null || f.cap == null || f.cua == null; }).length;
    if(!confirmTwice(t, faltan ? `Faltan rubros de ${faltan} persona${faltan > 1 ? 's' : ''} (cuentan como 0). Tocá de nuevo para cerrar igual.` : 'Tocá de nuevo para cerrar la calificación. Después no se puede modificar.')) return true;
    const filas = ppl.map(p => { const A = calAsistencia(p.n, R); return { pid: p.id, pct: Math.round(A.pct * 10) / 10, pts: A.pts }; });
    try { const n = await call('calif_cerrar', { anio: S.calAnio, filas }); toast(`Calificación cerrada (${n} integrantes). Se publicó la mención.`); await loadPublic(); await calLoad(S.calAnio); render(); } catch(e){}
    return true; }
  if(t.id === 'calreabrir'){ if(!confirmTwice(t, 'Tocá de nuevo para reabrir la calificación.')) return true;
    try { await call('calif_reabrir', { anio: S.calAnio }); await calLoad(S.calAnio); render(); toast('Calificación reabierta.'); } catch(e){} return true; }
  if(t.id === 'calpdf'){ pdfCalificacion(viewerNow()); return true; }
  return false;
}
function califChange(e){
  const id = e.target.id || '';
  if(id === 'cal_anio'){ S.calAnioSel = +e.target.value; S.calSel = null; render(); return true; }
  if(e.target.dataset && e.target.dataset.calof){ const [pid, k] = e.target.dataset.calof.split('|'); calGuardar(+pid, { of: { [k]: e.target.value || null } }); return true; }
  return false;
}
