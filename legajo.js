/* =====================================================================
   LEGAJO PERSONAL
    · Etapa 1 · institucional: datos de ingreso, nivel de capacitación, departamentos,
      cursos y certificados, historial (ascensos, niveles, menciones) y calificaciones.
      Lo cargan admin, jefatura y superiores. Cada bombero ve el suyo (Guardia → Mi legajo).
    · Etapa 2 · datos personales y médicos (Ley 25.326). Requieren el consentimiento firmado.
      Los ven la persona, el Jefe, el Sub Jefe y los administradores. Cada consulta queda registrada.
    · Conservación: hasta 3 años después de la baja; después se borra solo (función legajo_depurar).
    · Pines: jerarquía (grados.js), nivel (escudo con número romano) y antigüedad
      (una estrella dorada cada 5 años sobre fondo rojo; a los 25, retiro efectivo).
   ===================================================================== */
const LEG_TIPOS = { ascenso: 'Ascenso', nivel: 'Nivel de capacitación', mencion: 'Mención', otro: 'Otro' };
const LEG_DOCS_MED = ['Apto físico', 'Ficha médica', 'Estudio médico', 'Certificado de vacunación'];
const mmaa = s => s ? `${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
const dmy = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
function aniosDesde(f){
  if(!f) return null;
  const a = P(f), n = new Date(); let y = n.getFullYear() - a.getFullYear();
  if(n.getMonth() < a.getMonth() || (n.getMonth() === a.getMonth() && n.getDate() < a.getDate())) y--;
  return Math.max(0, y);
}
const legCat = () => (S.leg && S.leg.cat) || { niveles: [], deptos: [] };
const nivelDe = id => legCat().niveles.find(n => n.id === id);
const deptoDe = id => legCat().deptos.find(d => d.id === id);
const iniciales = n => { const [ln, fn] = split(n); return ((fn || ' ')[0] + (ln || ' ')[0]).toUpperCase().trim(); };

/* ---------- pines ---------- */
function nivelPin(nv, h = 54){
  if(!nv) return '';
  const s = esc(nv.s), fs = s.length <= 1 ? 30 : s.length === 2 ? 26 : s.length === 3 ? 21 : 14;
  return `<svg class="lpin" viewBox="0 0 60 70" height="${h}" width="${Math.round(h * 60 / 70)}" role="img" aria-label="${esc(nv.n)}"><title>${esc(nv.n)}</title>
    <path d="M30 2L56 12V36C56 52 44 63 30 68C16 63 4 52 4 36V12Z" fill="#1f3f66" stroke="#d6a915" stroke-width="4"/>
    <path d="M30 9L50 17V36C50 48 41 57 30 61C19 57 10 48 10 36V17Z" fill="#2c5a8f"/>
    <text x="30" y="${Math.round(37 + fs * 0.36)}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${fs}" fill="#f7dc6f">${s}</text></svg>`;
}
function legStar(x, y, r){
  let d = '';
  for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1); }
  return `<path d="${d}Z" fill="#f2c230" stroke="#8a6a00" stroke-width="0.8"/>`;
}
// Antigüedad: una estrella dorada cada 5 años (hasta 5, retiro efectivo a los 25), sobre fondo rojo.
function antigPin(anios, h = 54){
  const n = Math.min(5, Math.floor(anios / 5)), sp = 21, x0 = 60 - (n - 1) * sp / 2;
  const est = [...Array(n)].map((_, i) => legStar(x0 + i * sp, 24, 10)).join('');
  const t = anios >= 25 ? 'RETIRO EFECTIVO' : `${anios} AÑO${anios === 1 ? '' : 'S'}`;
  const tit = anios >= 25 ? `Retiro efectivo · ${anios} años` : `Antigüedad · ${anios} año${anios === 1 ? '' : 's'}`;
  return `<svg class="lpin" viewBox="0 0 120 60" height="${h}" width="${h * 2}" role="img" aria-label="${tit}"><title>${tit}</title>
    <rect x="2" y="2" width="116" height="56" rx="8" fill="#c8102e" stroke="#d6a915" stroke-width="3"/>
    ${n ? est : `<text x="60" y="33" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="22" fill="#f7dc6f">${anios}</text>`}
    <text x="60" y="52" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${anios >= 25 ? 11 : 13}" fill="#f7dc6f">${t}</text></svg>`;
}
function deptoPin(d, h = 56){
  if(!d) return '';
  if(d.img) return `<span class="dimg${d.activo === false ? ' off' : ''}" style="width:${h}px;height:${h}px" title="${esc(d.n)}"><img src="${esc(d.img)}" alt="${esc(d.n)}"></span>`;
  const s = esc(d.s), fs = s.length <= 2 ? 18 : s.length === 3 ? 15 : 12;
  return `<svg class="lpin${d.activo === false ? ' off' : ''}" viewBox="0 0 64 64" height="${h}" width="${h}" role="img" aria-label="${esc(d.n)}"><title>${esc(d.n)}</title>
    <circle cx="32" cy="32" r="30" fill="#e98a2c"/><circle cx="32" cy="32" r="24" fill="${esc(d.c || '#555')}"/>
    <text x="32" y="${Math.round(32 + fs * 0.36)}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${fs}" fill="#fff">${s}</text></svg>`;
}
const pinBox = (svg, txt) => svg ? `<div class="pin">${svg}<span>${txt}</span></div>` : '';
function pinesDe(n, L, h = 54){
  const p = member(n) || {}, g = gradoDe(n), nv = nivelDe(L.niv), an = aniosDesde(L.efe);
  return pinBox(g ? insigniaSvg(g.k, h - 4, false) : '', g ? esc(g.n) : '')
    + pinBox(nivelPin(nv, h), nv ? esc(nv.n) : '')
    + (an != null && p.cat !== 'Aspirante' ? pinBox(antigPin(an, h), an >= 25 ? `Retiro efectivo · ${an} años` : `Antigüedad · ${an} año${an === 1 ? '' : 's'}`) : '');
}
function vencePill(v){
  if(!v) return '<span class="meta">—</span>';
  const d = Math.round((P(v) - P(dstr(new Date()))) / 864e5);
  if(d < 0) return `<span class="pill red">${mmaa(v)} · vencido</span>`;
  if(d < 60) return `<span class="pill orange">${mmaa(v)} · por vencer</span>`;
  return `<span class="pill green">${mmaa(v)} · vigente</span>`;
}

/* ---------- carga de datos ---------- */
// Pide los datos una sola vez; si falla deja `false` para mostrar "Reintentar" (sin bucles).
function legNeed(key, fn){
  if(S[key] != null) return false;
  if(!legNeed.busy){ legNeed.busy = true; fn().catch(e => { toast(e.message); S[key] = false; }).finally(() => { legNeed.busy = false; render(); }); }
  return true;
}
const legLoadList = async () => { S.leg = await rpc('legajo_lista', { tok: tokNow() }); };
const legLoadSel = async () => { S.legD = await rpc('legajo_ver', { tok: tokNow(), pid: S.legSel }); };
const legLoadPriv = async () => { const r = await rpc('legajo_privado_ver', { tok: tokNow(), pid: S.legSel }); r._pid = S.legSel; S.legP = r; };
async function legRefresh(){
  const tok = tokNow(), jobs = [rpc('legajo_lista', { tok }).then(r => { S.leg = r; })];
  if(S.legSel) jobs.push(rpc('legajo_ver', { tok, pid: S.legSel }).then(r => { S.legD = r; }));
  if(S.legSel && S.legP) jobs.push(rpc('legajo_privado_ver', { tok, pid: S.legSel }).then(r => { r._pid = S.legSel; S.legP = r; }));
  try { await Promise.all(jobs); } catch(e){ toast(e.message); }
}
async function legDo(fn, args, msg){
  if(S.busy) return null; S.busy = true;
  try { const r = await call(fn, args); if(msg) toast(msg); await legRefresh(); return (r == null || r === '') ? true : r; }
  catch(e){ return null; }
  finally { S.busy = false; render(); }
}
function legReset(){ S.leg = null; S.legD = null; S.legP = null; S.legSel = null; S.legTab = 'inst'; S.legEdit = null; S.legEditId = null; S.legDraft = null; S.legCat = null; S.legFile = null; S.fichas = null; }
const legRetry = '<div class="card"><p style="margin:0 0 8px">No se pudieron cargar los legajos.</p><button class="btn outline" id="legretry">Reintentar</button></div>';

/* ---------- panel: lista de legajos ---------- */
function vLegajosPanel(viewer){
  if(legNeed('leg', legLoadList)) return '<p class="lead">Cargando…</p>';
  if(S.leg === false) return legRetry;
  if(S.legEdit === 'cat') return vLegCatalogo();
  if(S.legSel) return vLegajo(viewer, false);
  const L = new Map(S.leg.personas.map(x => [x.id, x])), q = (S.legQ || '').trim().toLowerCase();
  const ppl = active().filter(p => L.has(p.id));
  const cargados = ppl.filter(p => { const x = L.get(p.id); return x.efe || x.asp || x.niv || x.num; }).length;
  const cons = ppl.filter(p => L.get(p.id).cons).length, venc = ppl.filter(p => L.get(p.id).cvence > 0).length;
  const hoy = dstr(new Date()), aptoV = S.leg.jefe ? ppl.filter(p => { const a = L.get(p.id).apto; return !a || a < hoy; }).length : null;
  const row = p => {
    const x = L.get(p.id), vacio = !(x.efe || x.asp || x.niv || x.num), nv = nivelDe(x.niv), an = aniosDesde(x.efe), g = gradoDe(p.n);
    const flags = [vacio ? '<span class="tag">Sin cargar</span>' : '', x.num ? `<span class="tag">N° ${esc(x.num)}</span>` : '',
      x.cvence ? '<span class="tag yellow">Certificado por vencer</span>' : '', x.cons ? '<span class="tag green">Consentimiento</span>' : '',
      S.leg.jefe && x.cons && x.apto && x.apto < hoy ? '<span class="tag red">Apto vencido</span>' : ''].join('');
    return `<li><button class="lrow" data-legsel="${p.id}"><span class="lav">${iniciales(p.n)}</span>
      <span class="lnm"><b>${esc(p.n)}</b><br><span class="meta">${g ? esc(g.a) + ' · ' : ''}${p.cat === 'Aspirante' ? 'Aspirante' : an != null ? `Efectivo desde ${x.efe.slice(0, 4)}` : 'Bombero'}${nv ? ' · ' + esc(nv.n) : ''}</span><br><span class="tags">${flags}</span></span>
      <span class="lpins">${g ? insigniaSvg(g.k, 24, true) : ''}${nivelPin(nv, 30)}${an != null && p.cat !== 'Aspirante' ? antigPin(an, 28) : ''}</span></button></li>`;
  };
  const vis = ppl.filter(p => !q || p.n.toLowerCase().includes(q));
  return `<p class="lead">Legajo de cada integrante: ingreso, nivel, departamentos, cursos e historial. ${S.leg.jefe ? 'También ves los datos personales y médicos de quienes firmaron el consentimiento.' : 'Los datos personales y médicos los ven solo el Jefe, el Sub Jefe y los administradores.'}</p>
  <div class="kpis"><div class="kpi"><div class="n">${cargados}/${ppl.length}</div><div class="k">legajos con datos cargados</div></div>
    <div class="kpi"><div class="n">${cons}</div><div class="k">consentimientos firmados</div></div>
    <div class="kpi ${venc ? 'warn' : ''}"><div class="n">${venc}</div><div class="k">con certificados vencidos o por vencer</div></div>
    ${aptoV != null ? `<div class="kpi ${aptoV ? 'warn' : ''}"><div class="n">${aptoV}</div><div class="k">sin apto físico vigente</div></div>` : ''}</div>
  <div class="filters"><div class="field" style="flex:1 1 260px"><label class="label" for="legq">Buscar</label><input id="legq" type="search" placeholder="Apellido" value="${esc(S.legQ || '')}" autocomplete="off"></div>
    ${S.leg.jer ? '<button class="btn small outline" id="legcat">Niveles y departamentos</button>' : ''}
    <button class="btn small outline" id="legconspdf">Formulario de consentimiento (PDF)</button></div>
  ${groupsOf(vis).map(([k, t, list]) => list.length ? `<div class="card" style="margin-bottom:12px"><h3>${t} <span class="meta">· ${list.length}</span></h3><ul class="list leglist">${list.map(row).join('')}</ul></div>` : '').join('') || '<p class="empty">Nadie con ese apellido.</p>'}`;
}

/* ---------- legajo de una persona ---------- */
function vMiLegajo(b){
  const p = member(b); if(!p) return '';
  if(S.legSel !== p.id){ S.legSel = p.id; S.legD = null; S.legP = null; S.legEdit = null; }
  if(legNeed('leg', legLoadList)) return '<p class="lead">Cargando…</p>';
  if(S.leg === false) return legRetry;
  return vLegajo(b, true);
}
function vLegajo(viewer, mine){
  if(S.legD && S.legD.id !== S.legSel) S.legD = null;
  if(legNeed('legD', legLoadSel)) return '<p class="lead">Cargando…</p>';
  if(S.legD === false) return legRetry;
  const D = S.legD, L = D.leg || {}, p = S.roster.find(r => r.id === D.id) || { n: D.n, cat: 'Bombero', g: 0 };
  const tab = S.legTab === 'priv' && D.priv ? 'priv' : 'inst';
  const ubic = p.cargo || (p.g ? 'Guardia ' + p.g : 'Sin guardia');
  const ingreso = p.cat === 'Aspirante' ? `Aspirante${L.asp ? ' desde ' + L.asp.slice(0, 4) : ''}` : L.efe ? `Bombero efectivo desde ${L.efe.slice(0, 4)}` : 'Bombero';
  const fotoOk = D.cons && D.cons.foto;
  const foto = L.foto ? `<img class="foto" src="${esc(L.foto)}" alt="Foto de ${esc(nice(D.n))}">` : `<div class="foto">${iniciales(D.n)}</div>`;
  const fotoBtns = D.editor && !mine ? (fotoOk ? `<div class="row" style="gap:6px;margin-top:8px;justify-content:center"><label class="btn small outline filebtn">${L.foto ? 'Cambiar foto' : 'Cargar foto'}<input type="file" id="legfoto" accept="image/*"></label>${L.foto ? '<button class="btn small" id="legfotodel">Quitar</button>' : ''}</div>`
    : '<p class="meta" style="margin:6px 0 0;max-width:120px;text-align:center;font-size:12px">La foto requiere autorización en el consentimiento.</p>') : '';
  return `<div class="who"><div><span class="label">${mine ? 'Mi legajo' : 'Panel · Legajos'}</span><h2>${mine ? 'Mi legajo' : 'Legajo de ' + esc(nice(D.n))}</h2></div>
    <span class="row" style="gap:8px">${mine ? '<button class="btn outline small" data-mode="">Volver</button>' : '<button class="btn outline small" id="legback">← Volver a la lista</button>'}<button class="btn primary small" id="legpdf">Foja de servicios (PDF)</button></span></div>
  <div class="lhead"><div class="lfoto">${foto}${fotoBtns}</div><div style="min-width:0"><div class="lname">${esc(nombreConGrado(D.n))}</div>
    <div class="meta">${[esc(ubic), ingreso, L.num ? 'Legajo N° ' + esc(L.num) : ''].filter(Boolean).join(' · ')}</div>
    <div class="pins">${pinesDe(D.n, L) || '<span class="meta">Todavía sin jerarquía, nivel ni antigüedad cargados.</span>'}</div></div></div>
  ${D.priv ? `<div class="seg" role="tablist" style="margin-top:16px"><button data-legtab="inst" aria-selected="${tab === 'inst'}">Institucional</button><button data-legtab="priv" aria-selected="${tab === 'priv'}">Personal y médico</button></div>` : '<div style="height:16px"></div>'}
  ${tab === 'priv' ? vLegPriv(D, mine) : vLegInst(D, mine)}`;
}

function vLegInst(D, mine){
  const L = D.leg || {}, g = gradoDe(D.n), nv = nivelDe(L.niv), an = aniosDesde(L.efe), ed = D.editor && !mine;
  let top;
  if(S.legEdit === 'inst' && ed) top = vLegInstForm(D);
  else top = `<div class="grid2">
    <div class="card"><div class="top"><h3>Departamentos</h3>${ed ? '<button class="btn small outline" data-legedit="inst">Editar</button>' : ''}</div>
      <div class="depts">${D.deps.map(x => { const d = deptoDe(x.id); return d ? `<div class="dep">${deptoPin(d)}<span>${esc(d.n)}</span>${x.resp ? '<span class="tag yellow">Responsable</span>' : ''}${x.desde ? `<span class="meta" style="font-size:12px">desde ${x.desde.slice(0, 4)}</span>` : ''}</div>` : ''; }).join('') || '<p class="meta" style="margin:0">Sin departamentos asignados.</p>'}</div></div>
    <div class="card"><div class="top"><h3>Datos institucionales</h3>${ed ? '<button class="btn small outline" data-legedit="inst">Editar</button>' : ''}</div>
      <dl class="dl2"><dt>Legajo N°</dt><dd>${esc(L.num || '—')}</dd>
      <dt>Ingreso como aspirante</dt><dd>${mmaa(L.asp)}</dd>
      <dt>Bombero efectivo</dt><dd>${L.efe ? `${mmaa(L.efe)} · ${an} año${an === 1 ? '' : 's'}` : '—'}</dd>
      <dt>Nivel de capacitación</dt><dd>${nv ? esc(nv.n) + (L.nivDesde ? ` (desde ${L.nivDesde.slice(0, 4)})` : '') : '—'}</dd>
      <dt>Jerarquía</dt><dd>${g ? esc(g.n) + (L.jerDesde ? ` (desde ${L.jerDesde.slice(0, 4)})` : '') : 'Sin grado'}</dd>
      <dt>Contacto de emergencia</dt><dd>${esc(L.contacto || '—')}</dd></dl>
      ${L.act ? `<p class="meta" style="margin:10px 0 0;font-size:13px">Actualizado ${fmtD(loc(L.act))}${L.por ? ' por ' + esc(nice(L.por)) : ''}</p>` : ''}</div></div>`;
  // cursos
  const cursos = D.cursos, edC = S.legEdit === 'curso' && ed;
  const accC = c => ed ? `<button class="btn small" data-legeditcurso="${c.id}">Editar</button> <button class="btn small" id="legdelc${c.id}" data-legdel="${c.id}">Quitar</button>` : '';
  const verC = c => c.arch ? `<button class="linkbtn" data-legarch="${c.id}">Ver ${c.mime === 'application/pdf' ? 'PDF' : 'foto'}</button>` : '<span class="meta">—</span>';
  const cursosHtml = cursos.length ? (mine ? `<div class="card"><ul class="list">${cursos.map(c => `<li><span><b>${esc(c.t)}</b><br><span class="meta">${esc(c.inst || '')}${c.inst ? ' · ' : ''}${mmaa(c.f)}</span><br>${c.v ? vencePill(c.v) : ''}</span>${verC(c)}</li>`).join('')}</ul></div>`
    : `<div class="tablewrap"><table><thead><tr><th>Curso</th><th>Institución</th><th>Fecha</th><th>Vence</th><th>Certificado</th>${ed ? '<th></th>' : ''}</tr></thead><tbody>
      ${cursos.map(c => `<tr><td>${esc(c.t)}</td><td>${esc(c.inst || '')}</td><td class="mono">${mmaa(c.f)}</td><td>${vencePill(c.v)}</td><td>${verC(c)}</td>${ed ? `<td style="text-align:right">${accC(c)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`)
    : `<div class="card"><p class="meta" style="margin:0">Todavía no hay cursos ni certificados cargados.</p></div>`;
  // historial
  const H = D.hist, edH = S.legEdit === 'hist' && ed;
  return `${top}
  <div class="section-h"><h3 style="margin:0">Cursos y certificados</h3>${ed && !edC ? '<button class="btn small outline" data-legedit="curso">Agregar certificado</button>' : ''}</div>
  ${edC ? vLegArchForm('curso', cursos.find(c => c.id === S.legEditId)) : ''}${cursosHtml}
  <div class="section-h"><h3 style="margin:0">Historial</h3></div>
  <div class="grid2">
    <div class="card"><h3>Calificaciones</h3><ul class="list">${D.calif.map(c => `<li><span>${c.anio}</span><span><b class="mono">${c.total ?? '—'}</b>/20 · <span class="pill ${calCptCls(c.concepto)}">${esc(c.concepto || '')}</span></span></li>`).join('') || '<li class="empty">Sin calificaciones cerradas todavía.</li>'}</ul></div>
    <div class="card"><div class="top"><h3>Ascensos, niveles y menciones</h3>${ed && !edH ? '<button class="btn small outline" data-legedit="hist">Agregar</button>' : ''}</div>
      ${edH ? `<div class="pedit2"><div class="row"><div class="field"><label class="label" for="lh_f">Fecha</label><input id="lh_f" type="date" max="${dstr(new Date())}" value="${dstr(new Date())}"></div>
        <div class="field"><label class="label" for="lh_tipo">Tipo</label><select id="lh_tipo">${Object.entries(LEG_TIPOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div></div>
        <div class="field"><label class="label" for="lh_t">Detalle</label><input id="lh_t" placeholder="Ej.: Mención por mayor puntaje de suboficiales" maxlength="300"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary small" id="legsavehist">Guardar</button><button class="btn small" id="legcancel">Cancelar</button></div></div>` : ''}
      <ul class="list">${H.map(h => `<li><span>${esc(h.t)}<br><span class="meta">${LEG_TIPOS[h.tipo] || ''}</span></span><span class="meta mono">${mmaa(h.f)}${ed ? ` <button class="x" id="legdelh${h.id}" data-leghdel="${h.id}" aria-label="Quitar">×</button>` : ''}</span></li>`).join('') || '<li class="empty">Sin registros. Los ascensos y cambios de nivel se anotan solos.</li>'}</ul></div>
  </div>
  ${mine ? '<p class="demo" style="margin-top:14px">Si algo está mal o falta un curso, pedile a la jefatura o a tu superior que lo corrija.</p>' : ''}`;
}

function vLegInstForm(D){
  const L = D.leg || {}, X = S.legDraft || {}, v = (k, d) => esc(X[k] ?? d ?? ''), hoy = dstr(new Date());
  const niveles = legCat().niveles.filter(n => n.activo || n.id === L.niv);
  const deps = X.deps || [], sel = new Set(deps.map(x => x.id));
  const dlist = legCat().deptos.filter(d => d.activo || sel.has(d.id));
  return `<div class="card pedit2"><h3>Editar datos institucionales</h3>
    <div class="row"><div class="field"><label class="label" for="li_num">Legajo N°</label><input id="li_num" value="${v('num', L.num)}" maxlength="20"></div>
    <div class="field"><label class="label" for="li_asp">Ingreso como aspirante</label><input id="li_asp" type="date" max="${hoy}" value="${v('asp', L.asp)}"></div>
    <div class="field"><label class="label" for="li_efe">Bombero efectivo (cuenta la antigüedad)</label><input id="li_efe" type="date" max="${hoy}" value="${v('efe', L.efe)}"></div></div>
    <div class="row"><div class="field"><label class="label" for="li_niv">Nivel de capacitación</label><select id="li_niv"><option value="">Sin nivel</option>${niveles.map(n => `<option value="${n.id}" ${String(X.niv ?? L.niv ?? '') === String(n.id) ? 'selected' : ''}>${esc(n.n)}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="li_nivd">Nivel desde</label><input id="li_nivd" type="date" max="${hoy}" value="${v('nivDesde', L.nivDesde)}"></div></div>
    <div class="row">${D.jer ? `<div class="field"><label class="label" for="li_jer">Jerarquía</label><select id="li_jer">${gradoOptions(X.jer ?? ((S.jer || {})[D.n] || ''))}</select></div>` : ''}
    <div class="field"><label class="label" for="li_jerd">Jerarquía desde</label><input id="li_jerd" type="date" max="${hoy}" value="${v('jerDesde', L.jerDesde)}"></div></div>
    <div class="field"><label class="label" for="li_cont">Contacto de emergencia</label><input id="li_cont" value="${v('contacto', L.contacto)}" placeholder="Nombre (vínculo) · teléfono" maxlength="160"></div>
    <span class="label" style="display:block;margin-top:16px">Departamentos</span>
    <div class="chips" style="margin-top:6px">${dlist.map(d => `<button class="chip" data-legdep="${d.id}" aria-pressed="${sel.has(d.id)}">${esc(d.n)}</button>`).join('')}</div>
    ${deps.length ? `<ul class="list" style="margin-top:8px">${deps.map(x => { const d = deptoDe(x.id); return `<li><span class="row" style="align-items:center;gap:10px">${deptoPin(d, 34)}<b>${esc(d ? d.n : '')}</b></span>
      <span class="row" style="gap:10px;align-items:center"><label class="meta" for="ld_d${x.id}">Desde</label><input id="ld_d${x.id}" type="date" max="${hoy}" value="${esc(x.desde || '')}" style="padding:6px;border:2px solid var(--line);border-radius:6px">
      <label class="check" style="margin:0"><input type="checkbox" id="ld_r${x.id}" ${x.resp ? 'checked' : ''}> Responsable</label></span></li>`; }).join('')}</ul>` : ''}
    ${D.jer ? '' : '<p class="demo" style="margin:10px 0 0">La jerarquía la cambian la jefatura o un administrador.</p>'}
    <div class="row" style="margin-top:14px"><button class="btn primary" id="legsaveinst">Guardar</button><button class="btn" id="legcancel">Cancelar</button></div></div>`;
}
function legInstCapture(){
  const X = S.legDraft || (S.legDraft = {}), val = id => { const e = $('#' + id); return e ? e.value : undefined; };
  for(const [k, id] of [['num', 'li_num'], ['asp', 'li_asp'], ['efe', 'li_efe'], ['niv', 'li_niv'], ['nivDesde', 'li_nivd'], ['jer', 'li_jer'], ['jerDesde', 'li_jerd'], ['contacto', 'li_cont']]){ const x = val(id); if(x !== undefined) X[k] = x; }
  (X.deps || []).forEach(d => { const a = $('#ld_d' + d.id), r = $('#ld_r' + d.id); if(a) d.desde = a.value; if(r) d.resp = r.checked; });
  return X;
}

// Formulario de certificado (clase 'curso') o documento médico ('medico').
function vLegArchForm(clase, c){
  c = c || {}; const med = clase === 'medico', hoy = dstr(new Date()), f = S.legFile;
  return `<div class="card pedit2" style="margin-bottom:12px"><h3>${c.id ? 'Editar' : 'Agregar'} ${med ? 'documento médico' : 'curso o certificado'}</h3>
    <div class="row"><div class="field" style="flex:2 1 240px"><label class="label" for="la_t">${med ? 'Documento' : 'Curso'}</label><input id="la_t" value="${esc(c.t || '')}" ${med ? 'list="la_meds"' : ''} placeholder="${med ? 'Ej.: Apto físico' : 'Ej.: Rescate vehicular avanzado'}" maxlength="160">${med ? `<datalist id="la_meds">${LEG_DOCS_MED.map(x => `<option value="${x}">`).join('')}</datalist>` : ''}</div>
    ${med ? '' : `<div class="field" style="flex:2 1 220px"><label class="label" for="la_inst">Institución</label><input id="la_inst" value="${esc(c.inst || '')}" placeholder="Ej.: Federación Córdoba" maxlength="120"></div>`}</div>
    <div class="row"><div class="field"><label class="label" for="la_f">Fecha</label><input id="la_f" type="date" max="${hoy}" value="${esc(c.f || '')}"></div>
    <div class="field"><label class="label" for="la_v">Vence (si vence)</label><input id="la_v" type="date" value="${esc(c.v || '')}"></div></div>
    <div class="field"><span class="label">Archivo (foto o PDF, hasta 2 MB)</span>
      <div class="row" style="align-items:center;gap:10px"><label class="btn small outline filebtn">${f ? 'Cambiar archivo' : 'Elegir archivo'}<input type="file" id="la_file" accept="image/*,application/pdf"></label>
      <span class="meta">${f ? 'Listo para subir: ' + esc(f.nombre) : c.arch ? 'Actual: ' + esc(c.arch) : 'Sin archivo'}</span>
      ${c.arch && !f ? '<label class="check" style="margin:0"><input type="checkbox" id="la_sin"> Quitar el archivo</label>' : ''}</div></div>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="legsavearch" data-clase="${clase}">Guardar</button><button class="btn" id="legcancel">Cancelar</button></div></div>`;
}

/* ---------- etapa 2: datos personales y médicos ---------- */
function vLegPriv(D, mine){
  if(S.legP && S.legP._pid !== D.id) S.legP = null;
  if(legNeed('legP', legLoadPriv)) return '<p class="lead">Cargando…</p>';
  if(S.legP === false) return legRetry;
  const X = S.legP, d = X.datos, jefe = X.jefe && !mine, nom = esc(split(D.n)[1] || nice(D.n));
  const lock = `<div class="lock"><span aria-hidden="true" style="font-size:20px">&#128274;</span><div><b>Información sensible protegida (Ley 25.326).</b><br>
    ${mine ? 'Tus datos personales y médicos los ven solo vos, el Jefe, el Sub Jefe y los administradores del sistema. Quien esté a cargo de un siniestro activo en el que participes ve tu ficha de emergencia. Cada consulta queda registrada abajo.'
      : `La ven solo ${nom}, el Jefe, el Sub Jefe, los administradores del sistema y quien esté a cargo de un siniestro activo en el que participe. Cada vez que alguien la abre queda registrado.`}</div></div>`;
  const accesos = `<div class="card"><h3>Historial de accesos</h3><ul class="list">${X.accesos.map(a => `<li><span>${esc(a.por ? nice(a.por) : 'Sistema')}${a.cargo || S.perms[a.por] === 'admin' ? ` <span class="meta">(${esc(a.cargo || 'Administrador')})</span>` : ''}<br><span class="meta">${esc(a.t)}</span></span><span class="meta mono">${fmtD(loc(a.ts))}</span></li>`).join('') || '<li class="empty">Nadie consultó estos datos todavía.</li>'}</ul></div>`;
  const derechos = `<div class="card"><h3>${mine ? 'Tus derechos' : 'Derechos de ' + nom}</h3><p style="margin:0">${mine ? 'Podés' : 'Puede'} ver todo lo cargado, pedir que se corrija y retirar el consentimiento en cualquier momento, por escrito ante la jefatura. Si lo retira, estos datos se borran y queda solo el legajo institucional. Todo el legajo se conserva hasta 3 años después de la baja y después se borra. Órgano de control: Agencia de Acceso a la Información Pública.</p></div>`;
  if(!d){
    return `${lock}<div class="grid2" style="margin-top:16px">
      <div class="card alert"><h3>Sin consentimiento firmado</h3><p style="margin:0 0 8px">Sin el consentimiento no se cargan datos personales ni médicos.${mine ? ' Si querés que el cuartel tenga tus datos para una emergencia, pedile el formulario a la jefatura.' : ' Imprimí el formulario, que lo lea y lo firme, y después registralo acá.'}</p>
        <button class="btn outline" id="legconspdf1">Formulario de consentimiento (PDF)</button></div>
      ${jefe ? vLegConsForm(null) : ''}</div>
      <div class="grid2" style="margin-top:16px">${accesos}${derechos}</div>`;
  }
  const aut = (ok, t) => `<span class="tag ${ok ? 'green' : ''}">${ok ? '✓' : '✗'} ${t}</span>`;
  const editCons = S.legEdit === 'cons' && jefe, editPriv = S.legEdit === 'priv' && jefe, edM = S.legEdit === 'medico' && jefe;
  const docs = X.docs, verD = c => c.arch ? `<button class="linkbtn" data-legarch="${c.id}">Ver ${c.mime === 'application/pdf' ? 'PDF' : 'foto'}</button>` : '<span class="meta">—</span>';
  const g = d.grupo ? d.grupo + (d.factor || '') : null;
  return `${lock}
  <div class="consbar"><span class="pill green">Consentimiento firmado el ${dmy(d.fecha)}</span><span class="tags">${aut(d.salud, 'Datos de salud')}${aut(d.emergencia, 'Informar en emergencias')}${aut(d.foto, 'Foto')}</span>
    ${jefe && !editCons ? '<span class="row" style="gap:6px;margin-left:auto"><button class="btn small outline" data-legedit="cons">Modificar autorizaciones</button><button class="btn small" id="legrevocar">Retirar consentimiento</button></span>' : ''}</div>
  ${editCons ? vLegConsForm(d) : ''}
  ${editPriv ? vLegPrivForm(d) : `<div class="grid2">
    <div class="card"><div class="top"><h3>Datos personales</h3>${jefe ? '<button class="btn small outline" data-legedit="priv">Editar</button>' : ''}</div>
      <dl class="dl2"><dt>DNI</dt><dd>${esc(d.dni || '—')}</dd><dt>Fecha de nacimiento</dt><dd>${d.nac ? dmy(d.nac) + ` (${aniosDesde(d.nac)} años)` : '—'}</dd>
      <dt>Domicilio</dt><dd>${esc(d.dom || '—')}</dd><dt>Teléfono</dt><dd>${esc(d.tel || '—')}</dd><dt>Correo</dt><dd>${esc(d.email || '—')}</dd>
      <dt>Obra social</dt><dd>${esc(d.os || '—')}${d.afil ? ' · N° ' + esc(d.afil) : ''}</dd>
      <dt>Contacto de emergencia</dt><dd>${esc((D.leg || {}).contacto || '—')}</dd></dl></div>
    <div class="card"><div class="top"><h3>Datos médicos</h3>${jefe && d.salud ? '<button class="btn small outline" data-legedit="priv">Editar</button>' : ''}</div>
      ${d.salud ? `<div class="medgrid"><div><span class="label">Grupo y factor</span><div class="blood">${g ? esc(g) : '—'}</div></div>
        <dl class="dl2"><dt>Alergias</dt><dd>${esc(d.alergias || 'Ninguna informada')}</dd><dt>Medicación habitual</dt><dd>${esc(d.medicacion || 'Ninguna informada')}</dd>
        <dt>Condiciones a tener en cuenta</dt><dd>${esc(d.condiciones || 'Ninguna informada')}</dd><dt>Vacunas</dt><dd>${esc(d.vacunas || '—')}</dd></dl></div>`
        : '<p class="meta" style="margin:0">El consentimiento no autoriza datos de salud.</p>'}</div></div>`}
  <div class="section-h"><h3 style="margin:0">Documentación médica</h3>${jefe && d.salud && !edM ? '<button class="btn small outline" data-legedit="medico">Subir documento</button>' : ''}</div>
  ${edM ? vLegArchForm('medico', docs.find(c => c.id === S.legEditId)) : ''}
  ${docs.length ? `<div class="card"><ul class="list">${docs.map(c => `<li><span><b>${esc(c.t)}</b><br><span class="meta">${c.f ? dmy(c.f) : 'Sin fecha'}</span> ${c.v ? vencePill(c.v) : ''}</span>
      <span class="row" style="gap:8px;align-items:center">${verD(c)}${jefe ? `${c.clase === 'medico' ? `<button class="btn small" data-legeditmed="${c.id}">Editar</button>` : ''}<button class="btn small" id="legdelm${c.id}" data-legdel="${c.id}">Quitar</button>` : ''}</span></li>`).join('')}</ul></div>`
    : `<div class="card"><p class="meta" style="margin:0">${d.salud ? 'Sin documentos cargados (apto físico, ficha médica…).' : 'Sin documentos.'}</p></div>`}
  <div class="grid2" style="margin-top:16px">${accesos}${derechos}</div>
  ${mine ? '<p class="demo" style="margin-top:14px">Si algo está mal, pedile al Jefe o al Sub Jefe que lo corrija.</p>' : ''}`;
}
function vLegConsForm(d){
  const hoy = dstr(new Date()), f = S.legFile;
  return `<div class="card pedit2" style="margin-bottom:16px"><h3>${d ? 'Modificar autorizaciones' : 'Registrar consentimiento firmado'}</h3>
    <div class="field"><label class="label" for="lc_f">Fecha de firma</label><input id="lc_f" type="date" max="${hoy}" value="${esc(d ? d.fecha : hoy)}"></div>
    <span class="label" style="display:block;margin-top:14px">Lo que autorizó (según lo que marcó en el papel)</span>
    <label class="check"><input type="checkbox" id="lc_s" ${!d || d.salud ? 'checked' : ''}> Datos de salud (grupo sanguíneo, alergias, medicación, apto físico)</label>
    <label class="check"><input type="checkbox" id="lc_e" ${!d || d.emergencia ? 'checked' : ''}> Informar sus datos de salud imprescindibles al servicio que lo atienda en una emergencia</label>
    <label class="check"><input type="checkbox" id="lc_fo" ${!d || d.foto ? 'checked' : ''}> Foto en el legajo</label>
    <div class="field"><span class="label">Consentimiento escaneado o foto (opcional)</span>
      <div class="row" style="align-items:center;gap:10px"><label class="btn small outline filebtn">${f ? 'Cambiar archivo' : 'Elegir archivo'}<input type="file" id="lc_file" accept="image/*,application/pdf"></label><span class="meta">${f ? 'Listo para subir: ' + esc(f.nombre) : 'Sin archivo'}</span></div></div>
    ${d ? '<p class="demo" style="margin:10px 0 0">Si sacás la autorización de salud, se borran los datos médicos y sus documentos. Si sacás la de foto, se borra la foto.</p>' : ''}
    <div class="row" style="margin-top:14px"><button class="btn primary" id="legsavecons">${d ? 'Guardar' : 'Registrar'}</button>${d ? '<button class="btn" id="legcancel">Cancelar</button>' : ''}</div></div>`;
}
function vLegPrivForm(d){
  const v = k => esc(d[k] || ''), opt = (vals, cur) => vals.map(([x, t]) => `<option value="${x}" ${x === (cur || '') ? 'selected' : ''}>${t}</option>`).join('');
  return `<div class="card pedit2"><h3>Editar datos personales${d.salud ? ' y médicos' : ''}</h3>
    <div class="row"><div class="field"><label class="label" for="lp_dni">DNI</label><input id="lp_dni" value="${v('dni')}" inputmode="numeric" maxlength="12"></div>
    <div class="field"><label class="label" for="lp_nac">Fecha de nacimiento</label><input id="lp_nac" type="date" max="${dstr(new Date())}" value="${v('nac')}"></div>
    <div class="field"><label class="label" for="lp_tel">Teléfono</label><input id="lp_tel" value="${v('tel')}" inputmode="tel" maxlength="40"></div></div>
    <div class="row"><div class="field" style="flex:2 1 260px"><label class="label" for="lp_dom">Domicilio</label><input id="lp_dom" value="${v('dom')}" maxlength="160"></div>
    <div class="field"><label class="label" for="lp_email">Correo</label><input id="lp_email" type="email" value="${v('email')}" maxlength="120"></div></div>
    <div class="row"><div class="field"><label class="label" for="lp_os">Obra social</label><input id="lp_os" value="${v('os')}" maxlength="80"></div>
    <div class="field"><label class="label" for="lp_afil">N° de afiliado</label><input id="lp_afil" value="${v('afil')}" maxlength="40"></div></div>
    ${d.salud ? `<div class="row"><div class="field"><label class="label" for="lp_grupo">Grupo sanguíneo</label><select id="lp_grupo">${opt([['', '—'], ['0', '0'], ['A', 'A'], ['B', 'B'], ['AB', 'AB']], d.grupo)}</select></div>
      <div class="field"><label class="label" for="lp_factor">Factor</label><select id="lp_factor">${opt([['', '—'], ['+', '+ (positivo)'], ['-', '− (negativo)']], d.factor)}</select></div></div>
      <div class="field"><label class="label" for="lp_alerg">Alergias</label><input id="lp_alerg" value="${v('alergias')}" placeholder="Ej.: penicilina, picadura de abeja" maxlength="300"></div>
      <div class="field"><label class="label" for="lp_med">Medicación habitual</label><input id="lp_med" value="${v('medicacion')}" maxlength="300"></div>
      <div class="field"><label class="label" for="lp_cond">Condiciones a tener en cuenta</label><input id="lp_cond" value="${v('condiciones')}" placeholder="Ej.: asma, diabetes, marcapasos" maxlength="300"></div>
      <div class="field"><label class="label" for="lp_vac">Vacunas</label><input id="lp_vac" value="${v('vacunas')}" placeholder="Ej.: antitetánica 2024, hepatitis B" maxlength="300"></div>` : ''}
    <div class="row" style="margin-top:14px"><button class="btn primary" id="legsavepriv">Guardar</button><button class="btn" id="legcancel">Cancelar</button></div></div>`;
}

/* ---------- niveles y departamentos (admin y jefatura) ---------- */
function vLegCatalogo(){
  if(!S.legCat) S.legCat = JSON.parse(JSON.stringify(legCat()));
  const C = S.legCat;
  const fila = (k, x, i, n) => `<li class="catrow${x.activo === false ? ' off' : ''}"><span class="catpin">${k === 'niveles' ? nivelPin(x, 40) : deptoPin(x, 40)}</span>
    <span class="row" style="flex:1;gap:8px;align-items:end">
      <span class="field" style="flex:3 1 180px;margin:0"><label class="label" for="cat_n_${k}_${i}">Nombre</label><input id="cat_n_${k}_${i}" value="${esc(x.n)}" maxlength="80"></span>
      <span class="field" style="flex:1 1 70px;margin:0"><label class="label" for="cat_s_${k}_${i}">${k === 'niveles' ? 'Número' : 'Sigla'}</label><input id="cat_s_${k}_${i}" value="${esc(x.s)}" maxlength="${k === 'niveles' ? 6 : 5}"></span>
      ${k === 'deptos' ? `<span class="field" style="flex:0 0 64px;margin:0"><label class="label" for="cat_c_${i}">Color</label><input id="cat_c_${i}" type="color" value="${esc(x.c || '#555555')}" style="padding:2px;height:46px"></span>
        <label class="btn small outline filebtn" style="align-self:end">${x.img ? 'Cambiar insignia' : 'Subir insignia'}<input type="file" accept="image/*" data-catimg="${i}"></label>${x.img ? `<button class="btn small" data-catimgdel="${i}" style="align-self:end">Sin imagen</button>` : ''}` : ''}</span>
    <span class="row" style="gap:4px;align-self:end">${x.activo === false ? `<button class="btn small" data-catrest="${k}:${i}">Restaurar</button>` : `<button class="btn small" data-catup="${k}:${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="btn small" data-catdown="${k}:${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button><button class="btn small" data-catdel="${k}:${i}">Quitar</button>`}</span></li>`;
  const lista = k => C[k].map((x, i) => fila(k, x, i, C[k].length)).join('');
  return `<div class="who"><div><span class="label">Panel · Legajos</span><h2>Niveles y departamentos</h2></div><button class="btn outline small" id="legcancel">← Volver sin guardar</button></div>
  <p class="lead">Se pueden agregar, renombrar, ordenar o quitar. Si quitás uno que alguien tiene en su legajo, queda guardado como "quitado" (gris) y deja de ofrecerse; podés restaurarlo.</p>
  <div class="card" style="margin-bottom:16px"><div class="top"><h3>Niveles de capacitación</h3><button class="btn small outline" data-catadd="niveles">Agregar nivel</button></div>
    <p class="demo" style="margin:0 0 6px">El número va en el escudo (I, II, III…).</p><ul class="list catlist">${lista('niveles')}</ul></div>
  <div class="card"><div class="top"><h3>Departamentos</h3><button class="btn small outline" data-catadd="deptos">Agregar departamento</button></div>
    <p class="demo" style="margin:0 0 6px">Cada uno lleva un pin con su sigla y color. Si la Federación autoriza el uso de su insignia oficial, podés subir la imagen.</p><ul class="list catlist">${lista('deptos')}</ul></div>
  <div class="row" style="margin-top:16px"><button class="btn primary big" id="legsavecat" style="max-width:420px">Guardar niveles y departamentos</button></div>`;
}
function legCatCapture(){
  const C = S.legCat; if(!C) return;
  for(const k of ['niveles', 'deptos']) C[k].forEach((x, i) => {
    const n = $(`#cat_n_${k}_${i}`), s = $(`#cat_s_${k}_${i}`), c = k === 'deptos' ? $(`#cat_c_${i}`) : null;
    if(n) x.n = n.value; if(s) x.s = s.value; if(c) x.c = c.value;
  });
}

/* ---------- SCI: fichas de emergencia de la dotación ---------- */
function fichasBlock(x){
  const who = sess().who, p = member(who);
  const ok = (x.estado === 'activo' && x.cmd === who) || (p && p.cargo);
  if(!ok || !x.dot.length) return '';
  const F = S.fichas && S.fichas.sid === x.id ? S.fichas.rows : null;
  if(!F) return `<div class="card fichas" style="margin-top:16px"><h3>Fichas de emergencia</h3>
    <p style="margin:0 0 10px">Grupo sanguíneo, alergias, medicación, obra social y contacto de cada integrante de la dotación (de quienes firmaron el consentimiento). La consulta queda registrada en el legajo de cada uno.</p>
    <button class="btn primary" data-fichas="${x.id}">Ver fichas de la dotación</button></div>`;
  return `<div class="section-h"><h3 style="margin:0">Fichas de emergencia</h3><button class="btn small outline" id="fichasoff">Ocultar</button></div>
  <div class="fgrid">${F.map(f => `<div class="card ficha"><div class="top"><h3 style="font-size:20px">${esc(nice(f.n))}</h3><span class="pill">${esc(f.u)}</span></div>
    ${f.salud ? `<div class="medgrid"><div class="blood">${f.grupo ? esc(f.grupo + (f.factor || '')) : '—'}</div>
      <dl class="dl2"><dt>Alergias</dt><dd>${esc(f.alergias || 'Ninguna informada')}</dd><dt>Medicación</dt><dd>${esc(f.medicacion || 'Ninguna informada')}</dd><dt>Condiciones</dt><dd>${esc(f.condiciones || 'Ninguna informada')}</dd></dl></div>`
      : '<p class="meta" style="margin:0 0 6px">Sin datos médicos (no firmó el consentimiento de salud).</p>'}
    <dl class="dl2" style="margin-top:8px"><dt>Obra social</dt><dd>${esc(f.os || '—')}${f.afil ? ' · N° ' + esc(f.afil) : ''}</dd><dt>Contacto</dt><dd>${esc(f.contacto || '—')}</dd></dl></div>`).join('')}</div>`;
}

/* ---------- archivos ---------- */
async function legLeerArchivo(file, soloImagen){
  if(!file) return null;
  if(file.type === 'application/pdf' && !soloImagen){
    if(file.size > 2 * 1024 * 1024){ toast('El PDF pesa más de 2 MB. Escanealo en menor calidad o subí una foto.'); return null; }
    const data = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(new Error('No se pudo leer el archivo.')); r.readAsDataURL(file); });
    return { nombre: file.name, mime: 'application/pdf', data };
  }
  if(!/^image\//.test(file.type)){ toast(soloImagen ? 'Elegí una imagen.' : 'Solo fotos o PDF.'); return null; }
  toast('Preparando imagen…');
  const data = await comprimirImagen(file, soloImagen === 'foto' ? 480 : soloImagen === 'pin' ? 256 : 1600);
  return { nombre: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data };
}
async function legAbrirArchivo(aid){
  try {
    const r = await call('legajo_archivo', { aid }); if(!r || !r.data) return;
    const b = await (await fetch(r.data)).blob(), u = URL.createObjectURL(b);
    const w = window.open(u, '_blank');
    if(!w){ const a = document.createElement('a'); a.href = u; a.download = r.nombre || 'archivo'; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  } catch(e){}
}

/* ---------- acciones ---------- */
async function legajoAction(t){
  const d = t.dataset, enLeg = (S.ptab === 'legajos' && (S.tab === 'panel' || (S.tab === 'guardia' && S.mode === 'panel'))) || (S.tab === 'guardia' && S.mode === 'legajo');
  if(!enLeg) return false;
  const viewer = viewerNow();
  if(t.id === 'legretry'){ if(S.leg === false) S.leg = null; if(S.legD === false) S.legD = null; if(S.legP === false) S.legP = null; render(); return true; }
  if(d.legsel){ S.legSel = +d.legsel; S.legD = null; S.legP = null; S.legTab = 'inst'; S.legEdit = null; S.legFile = null; render(); window.scrollTo(0, 0); return true; }
  if(t.id === 'legback'){ S.legSel = null; S.legD = null; S.legP = null; S.legEdit = null; S.legFile = null; render(); return true; }
  if(d.legtab){ S.legTab = d.legtab; S.legEdit = null; S.legFile = null; render(); return true; }
  if(t.id === 'legcancel'){ S.legEdit = null; S.legEditId = null; S.legDraft = null; S.legCat = null; S.legFile = null; render(); return true; }
  if(t.id === 'legcat'){ S.legEdit = 'cat'; S.legCat = null; render(); window.scrollTo(0, 0); return true; }
  if(t.id === 'legconspdf' || t.id === 'legconspdf1'){ pdfConsentimiento(viewer, S.legD && S.legSel && t.id === 'legconspdf1' ? S.legD.n : null); return true; }
  if(t.id === 'legpdf'){ if(S.legD) pdfFoja(viewer, S.legD); return true; }
  if(d.legedit){
    S.legEdit = d.legedit; S.legEditId = null; S.legFile = null;
    if(d.legedit === 'inst'){ const L = S.legD.leg || {}; S.legDraft = { deps: S.legD.deps.map(x => ({ ...x })) }; }
    render(); return true;
  }
  if(d.legeditcurso){ S.legEdit = 'curso'; S.legEditId = +d.legeditcurso; S.legFile = null; render(); return true; }
  if(d.legeditmed){ S.legEdit = 'medico'; S.legEditId = +d.legeditmed; S.legFile = null; render(); return true; }
  if(d.legdep){ const X = legInstCapture(), id = +d.legdep, i = X.deps.findIndex(x => x.id === id);
    if(i >= 0) X.deps.splice(i, 1); else X.deps.push({ id, desde: '', resp: false }); render(); return true; }
  const D = S.legD, pid = S.legSel;
  if(t.id === 'legsaveinst'){
    const X = legInstCapture();
    if(D.jer && (X.jer || '') !== ((S.jer || {})[D.n] || '')){
      if(S.busy) return true;
      try { await call('asignar_jerarquia', { pid, jerarquia: X.jer || null }); await loadPublic(); } catch(e){ return true; }
      if(!X.jerDesde && X.jer) X.jerDesde = dstr(new Date());
    }
    const datos = { num: X.num, asp: X.asp, efe: X.efe, niv: X.niv, nivDesde: X.nivDesde, jerDesde: X.jerDesde, contacto: X.contacto, deps: X.deps.map(x => ({ id: x.id, desde: x.desde || null, resp: !!x.resp })) };
    if(await legDo('legajo_guardar', { pid, datos }, 'Legajo guardado.')){ S.legEdit = null; S.legDraft = null; render(); }
    return true;
  }
  if(t.id === 'legsavehist'){
    const datos = { f: $('#lh_f').value, tipo: $('#lh_tipo').value, t: $('#lh_t').value };
    if(datos.t.trim().length < 3){ toast('Escribí el detalle.'); return true; }
    if(await legDo('legajo_historial_guardar', { pid, datos }, 'Agregado al historial.')){ S.legEdit = null; render(); }
    return true;
  }
  if(d.leghdel){ if(!confirmTwice(t, 'Tocá de nuevo para quitarlo del historial.')) return true; await legDo('legajo_historial_quitar', { hid: +d.leghdel }, 'Quitado del historial.'); return true; }
  if(t.id === 'legsavearch'){
    const clase = d.clase, datos = { clase, id: S.legEditId || null, t: $('#la_t').value, inst: $('#la_inst')?.value || null, f: $('#la_f').value || null, v: $('#la_v').value || null };
    if(datos.t.trim().length < 2){ toast(clase === 'medico' ? 'Escribí qué documento es.' : 'Escribí el nombre del curso.'); return true; }
    if(S.legFile) datos.arch = S.legFile; else if($('#la_sin')?.checked) datos.sinArch = true;
    if(await legDo('legajo_archivo_guardar', { pid, datos }, 'Guardado.')){ S.legEdit = null; S.legEditId = null; S.legFile = null; render(); }
    return true;
  }
  if(d.legdel){ if(!confirmTwice(t, 'Tocá de nuevo para quitarlo.')) return true; await legDo('legajo_archivo_quitar', { aid: +d.legdel }, 'Quitado.'); return true; }
  if(d.legarch){ legAbrirArchivo(+d.legarch); return true; }
  if(t.id === 'legfotodel'){ if(!confirmTwice(t, 'Tocá de nuevo para quitar la foto.')) return true; await legDo('legajo_foto', { pid, data: null }, 'Foto quitada.'); return true; }
  if(t.id === 'legsavecons'){
    const datos = { fecha: $('#lc_f').value, salud: $('#lc_s').checked, emergencia: $('#lc_e').checked, foto: $('#lc_fo').checked };
    if(!datos.fecha){ toast('Indicá la fecha de firma.'); return true; }
    const prev = S.legP && S.legP.datos;
    if(prev && ((prev.salud && !datos.salud) || (prev.foto && !datos.foto)) && !confirmTwice(t, 'Se van a borrar datos (salud o foto). Tocá de nuevo para confirmar.')) return true;
    const file = S.legFile;
    if(!await legDo('legajo_consentimiento', { pid, datos }, prev ? 'Autorizaciones actualizadas.' : 'Consentimiento registrado. Ya podés cargar los datos.')) return true;
    if(file) await legDo('legajo_archivo_guardar', { pid, datos: { clase: 'consent', t: 'Consentimiento firmado', f: datos.fecha, arch: file } }, 'Consentimiento escaneado guardado.');
    S.legEdit = null; S.legFile = null; render(); return true;
  }
  if(t.id === 'legrevocar'){
    if(!confirmTwice(t, 'Se borran todos sus datos personales y médicos, sus documentos y la foto. Tocá de nuevo para confirmar.')) return true;
    await legDo('legajo_revocar', { pid }, 'Consentimiento retirado. Se borraron los datos personales y médicos.'); return true;
  }
  if(t.id === 'legsavepriv'){
    const val = id => $('#' + id) ? $('#' + id).value : null;
    const datos = { dni: val('lp_dni'), nac: val('lp_nac'), dom: val('lp_dom'), tel: val('lp_tel'), email: val('lp_email'), os: val('lp_os'), afil: val('lp_afil'),
      grupo: val('lp_grupo'), factor: val('lp_factor'), alergias: val('lp_alerg'), medicacion: val('lp_med'), condiciones: val('lp_cond'), vacunas: val('lp_vac') };
    if(await legDo('legajo_privado_guardar', { pid, datos }, 'Datos guardados.')){ S.legEdit = null; render(); }
    return true;
  }
  // catálogo
  const kv = s => { const [k, i] = s.split(':'); return [k, +i]; };
  if(d.catadd){ legCatCapture(); S.legCat[d.catadd].push(d.catadd === 'niveles' ? { n: '', s: '', activo: true } : { n: '', s: '', c: '#555555', img: null, activo: true }); render(); return true; }
  if(d.catup || d.catdown){ legCatCapture(); const [k, i] = kv(d.catup || d.catdown), j = d.catup ? i - 1 : i + 1, a = S.legCat[k]; if(j >= 0 && j < a.length){ [a[i], a[j]] = [a[j], a[i]]; } render(); return true; }
  if(d.catdel){ legCatCapture(); const [k, i] = kv(d.catdel), x = S.legCat[k][i];
    if(x.id){ const enUso = k === 'niveles' ? S.leg.personas.some(p => p.niv === x.id) : S.leg.personas.some(p => p.deps.includes(x.id)); if(enUso){ x.activo = false; toast('Está en uso: queda como "quitado" y deja de ofrecerse.'); render(); return true; } }
    S.legCat[k].splice(i, 1); render(); return true; }
  if(d.catrest){ legCatCapture(); const [k, i] = kv(d.catrest); S.legCat[k][i].activo = true; render(); return true; }
  if(d.catimgdel){ legCatCapture(); S.legCat.deptos[+d.catimgdel].img = null; render(); return true; }
  if(t.id === 'legsavecat'){
    legCatCapture(); const C = S.legCat;
    if([...C.niveles, ...C.deptos].some(x => !x.n.trim() || !x.s.trim())){ toast('Cada nivel y departamento necesita nombre y sigla.'); return true; }
    const niveles = C.niveles.map(x => ({ id: x.id || null, n: x.n.trim(), s: x.s.trim(), activo: x.activo !== false }));
    const deptos = C.deptos.map(x => ({ id: x.id || null, n: x.n.trim(), s: x.s.trim().toUpperCase(), c: x.c, img: x.img || null, activo: x.activo !== false }));
    if(await legDo('legajo_catalogo_guardar', { niveles, deptos }, 'Niveles y departamentos guardados.')){ S.legEdit = null; S.legCat = null; render(); }
    return true;
  }
  return false;
}
// Re-dibuja conservando lo que ya se tipeó en los campos (al elegir un archivo, por ejemplo).
function renderKeep(){
  const vals = [...document.querySelectorAll('input[id],select[id],textarea[id]')].filter(el => el.type !== 'file').map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value, el.type === 'checkbox']);
  render();
  for(const [id, v, cb] of vals){ const el = document.getElementById(id); if(el){ if(cb) el.checked = v; else el.value = v; } }
}
function legajoChange(e){
  const t = e.target, enLeg = (S.ptab === 'legajos' && (S.tab === 'panel' || (S.tab === 'guardia' && S.mode === 'panel'))) || (S.tab === 'guardia' && S.mode === 'legajo');
  if(!enLeg) return false;
  if(t.id === 'legq'){ S.legQ = t.value; render(); return true; }
  if(t.type !== 'file' || !t.files || !t.files.length) return false;
  legArchivoElegido(t, t.files[0]).catch(err => toast(err.message));
  return true;
}
async function legArchivoElegido(t, f){
  if(t.id === 'legfoto'){ const r = await legLeerArchivo(f, 'foto'); if(r) await legDo('legajo_foto', { pid: S.legSel, data: r.data }, 'Foto guardada.'); return; }
  if(t.dataset.catimg != null){ legCatCapture(); const r = await legLeerArchivo(f, 'pin'); if(r){ S.legCat.deptos[+t.dataset.catimg].img = r.data; render(); } return; }
  if(t.id === 'la_file' || t.id === 'lc_file'){ const r = await legLeerArchivo(f, false); if(r){ S.legFile = r; renderKeep(); } }
}
