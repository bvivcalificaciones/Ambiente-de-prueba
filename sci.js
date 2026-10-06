/* =====================================================================
   SCI · Sistema de Comando de Incidentes
    · Hidráulica: cálculos de referencia para el manejo de bombas (sin PIN).
    · Dotaciones: siniestros, unidades y funciones (todos ven; jefatura y superiores organizan).
    · Configuración: unidades, mangueras y funciones (administradores y jefatura).
    · Partes: de prensa (texto breve, sin datos sensibles) y de intervención (PDF completo con croquis).
   ===================================================================== */

/* ---------- hidráulica: fórmulas ---------- */
// Pérdida por fricción (IFSTA): FL[psi] = C × (Q[gpm]/100)² × (L[ft]/100), con C según el diámetro de la manguera.
const BAR_PSI = 14.5038, BAR_KG = 1.01972;
const HYD_ACC = { '': 0, bif: 0.7, mon: 1.7 };         // bar: bifurcación/siamesa ≈10 psi; monitor ≈25 psi
const ELEV_BAR_M = 0.0981;                              // bar por metro de desnivel (columna de agua)
function hydFriction(c, qLpm, lenM){ return c * Math.pow(qLpm / 378.54, 2) * (lenM / 30.48) / BAR_PSI; }
function hydSmoothBore(dMm, pBar){ return 0.0666 * dMm * dMm * Math.sqrt(pBar * 100); }   // Freeman en métrico: L/min
function hydCalc(H, mangueras){
  const m = mangueras[H.mang] || mangueras[0];
  const q = H.lanza === 'lisa' ? hydSmoothBore(+H.boq, +H.np) : +H.q;
  const len = Math.max(0, +H.tramos) * Math.max(0, +H.largo);
  const fl = hydFriction(m.c, q, len), per100 = hydFriction(m.c, q, 100);
  const elev = (+H.desn || 0) * ELEV_BAR_M, acc = HYD_ACC[H.acc] || 0;
  const pdp = +H.np + fl + elev + acc, lineas = Math.max(1, +H.lineas || 1), qTot = q * lineas;
  return { q, qTot, len, fl, per100, elev, acc, pdp, np: +H.np, m, lineas };
}
function nfaFlow(largo, ancho, pct, pisos){ return largo * ancho * 13.58 * (pct / 100) * Math.max(1, pisos); }   // NFA: gpm = área[ft²]/3

/* ---------- formato ---------- */
const sciCfg = () => S.sciCfg || { presion: 'bar', tramo: 20, unidades: [], mangueras: [{ n: '44,5 mm (1¾")', c: 15.5 }], funciones: ['Bombero'] };
function fmtP(bar, u){
  u = u || S.hyd.u;
  if(u === 'psi') return `${Math.round(bar * BAR_PSI)} psi`;
  const v = u === 'kg' ? bar * BAR_KG : bar;
  return `${v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${u === 'kg' ? 'kg/cm²' : 'bar'}`;
}
const fmtQ = q => `${Math.round(q).toLocaleString('es-AR')} L/min`;
const gpm = q => Math.round(q / 3.785);
function fmtMin(min){ if(!isFinite(min) || min <= 0) return '—'; const m = Math.floor(min), s = Math.round((min - m) * 60); return s ? `${m} min ${s} s` : `${m} min`; }

/* ---------- estado ---------- */
function hydInit(){
  if(S.hyd) return;
  const c = sciCfg(), mi = Math.max(0, c.mangueras.findIndex(m => /44/.test(m.n)));
  S.hyd = { u: c.presion || 'bar', lanza: 'niebla', np: 7, q: 230, boq: 22, mang: mi, tramos: 3, largo: c.tramo || 20, desn: 0, acc: '', lineas: 1,
            unidad: '', tanque: '', nL: 10, nA: 8, nP: 100, nPisos: 1 };
}
const LANZA_NP = { niebla: [[7, 'Estándar'], [5, 'Baja presión'], [3.5, 'Baja presión']], lisa: [[3.5, 'De mano'], [5.5, 'Monitor']], abast: [[1.5, 'Residual en la entrada'], [1, 'Residual mínima']] };
const CAUDALES = [115, 230, 360, 475, 750, 950, 1500, 1900];
const BOQUILLAS = [[13, '½"'], [16, '⅝"'], [19, '¾"'], [22, '⅞"'], [25, '1"'], [29, '1⅛"'], [32, '1¼"'], [38, '1½"'], [44, '1¾"'], [51, '2"']];
const sel = (id, opts, v) => `<select id="${id}">${opts.map(([val, t]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

/* ---------- pantalla principal ---------- */
function vSCI(){
  hydInit();
  const s = sess(), logged = s.step === 'me', v = logged ? s.who : null;
  const tabs = [['hid', 'Hidráulica'], ['dot', 'Dotaciones'], ...(logged && ['admin', 'jefatura'].includes(roleOf(v)) ? [['cfg', 'Configuración']] : [])];
  if(!tabs.some(([k]) => k === S.sciTab)) S.sciTab = 'hid';
  const head = `<div class="who"><div><span class="label">${v ? esc(nice(v)) + ' · ' : ''}Sistema de Comando de Incidentes</span><h2>SCI</h2></div>${logged ? '<button class="btn outline small" id="bye">Salir</button>' : ''}</div>
    <div class="seg" role="tablist">${tabs.map(([k, l]) => `<button data-scitab="${k}" aria-selected="${S.sciTab === k}">${l}</button>`).join('')}</div>`;
  if(S.sciTab === 'hid') return head + vHidraulica();
  if(!logged){
    if(s.step === 'pin') return head + vPin('Ingresá tu PIN', nice(s.who));
    if(s.step === 'newpin') return head + vNewPin();
    return head + vWho('Dotaciones', 'Ingresá con tu PIN para ver los siniestros. Jefatura y superiores organizan las dotaciones.', active());
  }
  if(S.sciTab === 'cfg') return head + vSciCfg();
  return head + vDotaciones(v);
}

/* ---------- hidráulica ---------- */
function vHidraulica(){
  const H = S.hyd, c = sciCfg();
  const npOpts = LANZA_NP[H.lanza].map(([b, t]) => [b, `${fmtP(b)} · ${t}`]);
  if(!LANZA_NP[H.lanza].some(([b]) => b === +H.np)) H.np = LANZA_NP[H.lanza][0][0];
  const un = c.unidades;
  return `<div class="grid2 hyd">
  <div class="card"><h3>Presión de bomba</h3>
    <div class="row">
      <div class="field"><label class="label" for="h_u">Mostrar presión en</label>${sel('h_u', [['bar', 'bar'], ['kg', 'kg/cm²'], ['psi', 'psi']], H.u)}</div>
      <div class="field"><label class="label" for="h_lanza">Salida de la línea</label>${sel('h_lanza', [['niebla', 'Lanza de niebla / caudal regulable'], ['lisa', 'Boquilla lisa (chorro pleno)'], ['abast', 'Abastecimiento a otra autobomba']], H.lanza)}</div>
    </div>
    <div class="row">
      <div class="field"><label class="label" for="h_np">${H.lanza === 'abast' ? 'Presión de llegada' : 'Presión en punta'}</label>${sel('h_np', npOpts, H.np)}</div>
      ${H.lanza === 'lisa'
        ? `<div class="field"><label class="label" for="h_boq">Diámetro de boquilla</label>${sel('h_boq', BOQUILLAS.map(([d, t]) => [d, `${d} mm (${t})`]), H.boq)}</div>`
        : `<div class="field"><label class="label" for="h_q">Caudal</label>${sel('h_q', CAUDALES.map(q => [q, `${q} L/min (${gpm(q)} gpm)`]), H.q)}</div>`}
    </div>
    <div class="row">
      <div class="field"><label class="label" for="h_mang">Manguera</label>${sel('h_mang', c.mangueras.map((m, i) => [i, m.n]), H.mang)}</div>
      <div class="field"><label class="label" for="h_tramos">Tramos</label><input id="h_tramos" type="number" min="0" max="60" value="${H.tramos}" inputmode="numeric"></div>
      <div class="field"><label class="label" for="h_largo">Metros por tramo</label><input id="h_largo" type="number" min="1" max="100" value="${H.largo}" inputmode="numeric"></div>
    </div>
    <div class="row">
      <div class="field"><label class="label" for="h_desn">Desnivel (m)</label><input id="h_desn" type="number" min="-100" max="200" value="${H.desn}" inputmode="numeric"><span class="hint">Positivo si la lanza está más alta. Un piso ≈ 3 m.</span></div>
      <div class="field"><label class="label" for="h_acc">Accesorio</label>${sel('h_acc', [['', 'Ninguno'], ['bif', `Bifurcación / siamesa (+${fmtP(0.7)})`], ['mon', `Monitor (+${fmtP(1.7)})`]], H.acc)}</div>
      <div class="field"><label class="label" for="h_lineas">Líneas iguales</label><input id="h_lineas" type="number" min="1" max="6" value="${H.lineas}" inputmode="numeric"></div>
    </div>
    <div class="row">
      <div class="field"><label class="label" for="h_unidad">Unidad</label>${sel('h_unidad', [['', un.length ? 'Elegir…' : 'Sin unidades cargadas'], ...un.map((x, i) => [i, x.n])], H.unidad)}</div>
      <div class="field"><label class="label" for="h_tanque">Agua en tanque (L)</label><input id="h_tanque" type="number" min="0" max="50000" value="${H.tanque}" placeholder="${H.unidad !== '' && un[H.unidad] ? un[H.unidad].tanque : 'Ej.: 3000'}" inputmode="numeric"></div>
    </div>
  </div>
  <div class="card hydres" id="hyd_out">${hydOut()}</div>
  </div>
  <div class="grid2" style="margin-top:16px">
    <div class="card"><h3>Caudal necesario (estimado)</h3>
      <div class="row">
        <div class="field"><label class="label" for="h_nL">Largo (m)</label><input id="h_nL" type="number" min="1" value="${H.nL}" inputmode="numeric"></div>
        <div class="field"><label class="label" for="h_nA">Ancho (m)</label><input id="h_nA" type="number" min="1" value="${H.nA}" inputmode="numeric"></div>
        <div class="field"><label class="label" for="h_nP">Involucrado</label>${sel('h_nP', [[25, '25 %'], [50, '50 %'], [75, '75 %'], [100, '100 %']], H.nP)}</div>
        <div class="field"><label class="label" for="h_nPisos">Pisos</label><input id="h_nPisos" type="number" min="1" max="10" value="${H.nPisos}" inputmode="numeric"></div>
      </div>
      <div id="nfa_out">${nfaOut()}</div>
    </div>
    <div class="card"><h3>Pérdida cada 100 m</h3>${lossTable()}</div>
  </div>
  <p class="demo" style="margin-top:12px">Cálculos de referencia para capacitación y planificación (fórmulas IFSTA y NFA). El manómetro de la bomba y las indicaciones del fabricante de lanzas y mangueras tienen siempre prioridad. Los coeficientes de cada manguera se ajustan en Configuración.</p>`;
}
function hydOut(){
  const H = S.hyd, c = sciCfg(), r = hydCalc(H, c.mangueras), un = c.unidades[H.unidad];
  const tanque = +H.tanque || (un ? +un.tanque : 0), warn = [];
  if(un && un.pmax && r.pdp > +un.pmax) warn.push(`Supera la presión máxima de la bomba de ${un.n} (${fmtP(+un.pmax)}).`);
  if(un && un.caudal && r.qTot > +un.caudal) warn.push(`Supera el caudal máximo de la bomba de ${un.n} (${fmtQ(+un.caudal)}).`);
  if(r.per100 > 3) warn.push('Pérdida muy alta para esa manguera: conviene un diámetro mayor o menos caudal.');
  if(r.pdp < 0.5) warn.push('La gravedad cubre casi toda la presión necesaria: regulá la bomba con cuidado.');
  return `<span class="label">Presión de trabajo en la bomba</span>
    <div class="hydbig">${fmtP(Math.max(0, r.pdp))}</div>
    <ul class="list">
      <li><span>${H.lanza === 'abast' ? 'Presión de llegada' : 'Presión en punta'}</span><b class="mono">${fmtP(r.np)}</b></li>
      <li><span>Pérdida por fricción · ${r.len} m de ${esc(r.m.n)}<br><span class="meta">${fmtP(r.per100)} cada 100 m</span></span><b class="mono">${fmtP(r.fl)}</b></li>
      <li><span>Desnivel · ${+H.desn || 0} m</span><b class="mono">${r.elev < 0 ? '−' : ''}${fmtP(Math.abs(r.elev))}</b></li>
      ${r.acc ? `<li><span>Accesorio</span><b class="mono">${fmtP(r.acc)}</b></li>` : ''}
    </ul>
    <div class="hydrow"><div><span class="label">Caudal por línea</span><b>${fmtQ(r.q)}</b><span class="meta">${gpm(r.q)} gpm</span></div>
      <div><span class="label">Caudal total${r.lineas > 1 ? ` (${r.lineas} líneas)` : ''}</span><b>${fmtQ(r.qTot)}</b><span class="meta">${gpm(r.qTot)} gpm</span></div>
      <div><span class="label">Autonomía del tanque</span><b>${tanque ? fmtMin(tanque / r.qTot) : '—'}</b><span class="meta">${tanque ? `${tanque.toLocaleString('es-AR')} L` : 'Cargá los litros'}</span></div></div>
    ${warn.map(w => `<div class="hydwarn">${esc(w)}</div>`).join('')}`;
}
function nfaOut(){
  const H = S.hyd, q = nfaFlow(+H.nL || 0, +H.nA || 0, +H.nP || 100, +H.nPisos || 1);
  const l230 = Math.ceil(q / 230), l475 = Math.ceil(q / 475);
  return `<div class="hydbig small">${fmtQ(q)}</div>
    <p class="meta" style="margin:4px 0 0">${(+H.nL * +H.nA || 0).toLocaleString('es-AR')} m² · equivale a ${l230} línea${l230 === 1 ? '' : 's'} de 230 L/min o ${l475} de 475 L/min. Fórmula NFA (área ÷ 3 en gpm), solo como orientación.</p>`;
}
function lossTable(){
  const c = sciCfg(), qs = [115, 230, 360, 475, 750, 950, 1500];
  return `<div class="tablewrap"><table class="losst"><thead><tr><th>Manguera</th>${qs.map(q => `<th class="num">${q}</th>`).join('')}</tr></thead><tbody>
    ${c.mangueras.map(m => `<tr><td>${esc(m.n)}</td>${qs.map(q => { const v = hydFriction(m.c, q, 100);
      return `<td class="num ${v > 3 ? 'zero' : v > 1.5 ? 'warn' : ''}">${v >= 100 ? '—' : fmtP(v).replace(/ (bar|kg\/cm²|psi)$/, '')}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div><p class="meta" style="margin:6px 0 0">Caudal en L/min · pérdida en ${S.hyd.u === 'kg' ? 'kg/cm²' : S.hyd.u}. En amarillo, pérdidas altas; en gris, poco prácticas.</p>`;
}
function sciInput(e){
  const id = e.target.id;
  if(id === 'pt_prensa'){ S.ptPrensa = e.target.value; return true; }
  if(id && id.startsWith('pt_') && S.ptDraft && id !== 'pt_fname' && id !== 'pt_file'){
    const hm = /^pt_(\w+)_(h|m)$/.exec(id);
    if(hm) S.ptDraft.d[hm[1]] = horaVal('pt_' + hm[1]); else S.ptDraft.d[id.slice(3)] = e.target.value;
    S.ptDraft.dirty = true;
    const x = sinNow(), o = $('#pt_prensa'); if(x && o && S.ptPrensa == null) o.value = prensaTxt(x, S.ptDraft.d);
    return true;
  }
  if(!id || !id.startsWith('h_')) return false;
  const k = id.slice(2); S.hyd[k] = e.target.value;
  if(['u', 'lanza', 'unidad', 'mang'].includes(k)){ if(k === 'unidad') S.hyd.tanque = ''; render(); return true; }
  const o = document.getElementById('hyd_out'); if(o) o.innerHTML = hydOut();
  const n = document.getElementById('nfa_out'); if(n) n.innerHTML = nfaOut();
  return true;
}

/* ---------- dotaciones ---------- */
const TIPOS_SIN = ['Incendio de vivienda', 'Incendio de comercio / industria', 'Incendio vehicular', 'Incendio forestal / pastizal', 'Accidente de tránsito / rescate vehicular', 'Materiales peligrosos', 'Rescate', 'Servicio especial', 'Otro'];
function vDotaciones(v){
  const D = S.sci || { siniestros: [], puede: false }, puede = !!D.puede;
  const sinS = D.siniestros.find(x => x.id === S.sciSel);
  if(sinS) return vSiniestro(sinS, puede);
  const act = D.siniestros.filter(x => x.estado === 'activo'), cer = D.siniestros.filter(x => x.estado !== 'activo');
  const card = x => `<button class="sincard ${x.estado}" data-sinsel="${x.id}">
      <span class="top"><span class="pill ${x.estado === 'activo' ? 'red' : ''}">${x.estado === 'activo' ? 'En curso' : 'Cerrado'}</span><span class="meta mono">${fmtD(loc(x.creado))}</span></span>
      <b>${esc(x.tipo)}</b><span>${esc(x.dir || 'Sin dirección')}</span>
      <span class="meta">${x.unidades.length} unidad${x.unidades.length === 1 ? '' : 'es'} · ${x.dot.length} bombero${x.dot.length === 1 ? '' : 's'}${x.cmd ? ' · a cargo ' + esc(nice(x.cmd)) : ''}</span></button>`;
  return `${puede ? (S.sinNew ? `<div class="card" style="margin-bottom:16px"><h3>Nuevo siniestro</h3>
      <div class="row"><div class="field"><label class="label" for="sn_tipo">Tipo</label><input id="sn_tipo" list="sn_tipos" placeholder="Ej.: Incendio de vivienda"><datalist id="sn_tipos">${TIPOS_SIN.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
      <div class="field"><label class="label" for="sn_dir">Dirección</label><input id="sn_dir" placeholder="Calle, número, referencia"></div></div>
      <div class="field"><label class="label" for="sn_notas">Notas iniciales</label><input id="sn_notas" placeholder="Ej.: humo denso, posible persona atrapada"></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="sincreate">Abrir siniestro</button><button class="btn" id="sinnew">Cancelar</button></div></div>`
    : '<button class="btn primary big" id="sinnew" style="margin:0 0 16px">Nuevo siniestro</button>') : ''}
  <div class="section-h" style="margin-top:0"><h3 style="margin:0">En curso · ${act.length}</h3><button class="btn small outline" id="sinreload">Actualizar</button></div>
  <div class="sincards">${act.map(card).join('') || '<p class="empty">No hay siniestros en curso.</p>'}</div>
  ${cer.length ? `<div class="section-h"><h3 style="margin:0">Cerrados</h3><button class="btn small outline" id="sinpast">${S.sinPast ? 'Ocultar' : 'Ver los ' + cer.length}</button></div>${S.sinPast ? `<div class="sincards">${cer.map(card).join('')}</div>` : ''}` : ''}
  ${puede ? '' : '<p class="demo" style="margin-top:12px">Solo jefatura y superiores organizan las dotaciones. Vos las ves para saber tu unidad y función.</p>'}`;
}
function vSiniestro(x, puede){
  const c = sciCfg(), editable = puede && x.estado === 'activo';
  const asign = new Map(x.dot.map(d => [d.n, d]));
  const unitCards = x.unidades.map(u => {
    const crew = x.dot.filter(d => d.u === u);
    return `<div class="card unitcard"><div class="top"><h3>${esc(u)}</h3><span class="pill">${crew.length}</span></div>
      <ul class="list">${crew.map(d => `<li><span>${insigniaDe(d.n, 14)} <b>${esc(d.n)}</b><br><span class="meta">${gradoDe(d.n) ? esc(gradoDe(d.n).a) + ' · ' : ''}${esc(d.f)}</span></span>${editable ? `<button class="btn small" data-sinquit="${esc(d.n)}">Quitar</button>` : ''}</li>`).join('') || '<li class="empty">Sin dotación asignada.</li>'}</ul></div>`;
  }).join('');
  const people = active().filter(p => !asign.has(p.n) || S.sinReasign);
  return `<button class="linkbtn" id="sinback" style="display:block;margin:2px 0 0">← Volver a la lista</button>
  <div class="sinhead ${x.estado}">
    <div><span class="pill ${x.estado === 'activo' ? 'red' : ''}">${x.estado === 'activo' ? 'En curso' : 'Cerrado'}</span><h2 style="margin:6px 0 2px">${esc(x.tipo)}</h2>
    <div>${esc(x.dir || 'Sin dirección')}</div><div class="meta">Desde ${fmtD(loc(x.creado))}${x.cerrado ? ' · cerrado ' + fmtD(loc(x.cerrado)) : ''} · a cargo: <b>${esc(x.cmd ? nice(x.cmd) : 'sin asignar')}</b></div>
    ${x.notas ? `<p style="margin:6px 0 0">${esc(x.notas)}</p>` : ''}</div>
    ${puede ? `<div class="row" style="gap:8px">${editable ? `<button class="btn primary" id="sinnotif">Avisar a la dotación</button><button class="btn outline" id="sinclose">Cerrar siniestro</button>` : `<button class="btn outline" id="sinopen">Reabrir</button>`}</div>` : ''}
  </div>
  ${editable ? `<div class="grid2" style="margin:16px 0">
    <div class="card"><h3>Unidades y mando</h3>
      <div class="chips" style="margin-bottom:8px">${x.unidades.map(u => `<span class="chip on">${esc(u)} <button class="x" data-sinunq="${esc(u)}" aria-label="Quitar ${esc(u)}">×</button></span>`).join('') || '<span class="meta">Todavía no hay unidades.</span>'}</div>
      <div class="row"><div class="field"><label class="label" for="sn_unit">Agregar unidad</label><input id="sn_unit" list="sn_units" placeholder="Ej.: Unidad 3"><datalist id="sn_units">${c.unidades.map(u => `<option value="${esc(u.n)}">`).join('')}</datalist></div>
      <div class="field" style="flex:0 0 auto;align-self:end"><button class="btn outline" id="sinunadd">Agregar</button></div></div>
      <div class="field"><label class="label" for="sn_cmd">A cargo del siniestro</label>${sel('sn_cmd', [['', 'Sin asignar'], ...active().map(p => [p.id, p.n])], (active().find(p => p.n === x.cmd) || {}).id || '')}</div>
      <button class="btn outline" style="margin-top:10px" id="sincmd">Guardar a cargo</button></div>
    <div class="card"><h3>Asignar bombero</h3>
      ${x.unidades.length ? `<div class="field"><label class="label" for="sn_per">Bombero</label>${sel('sn_per', [['', 'Elegir…'], ...people.map(p => [p.id, p.n + (asign.has(p.n) ? ` (ya en ${asign.get(p.n).u})` : '')])], '')}</div>
      <label class="check"><input type="checkbox" id="sn_reas" ${S.sinReasign ? 'checked' : ''}> Mostrar también a los ya asignados (para cambiarlos)</label>
      <div class="row"><div class="field"><label class="label" for="sn_u">Unidad</label>${sel('sn_u', x.unidades.map(u => [u, u]), x.unidades[0])}</div>
      <div class="field"><label class="label" for="sn_f">Función</label>${sel('sn_f', c.funciones.map(f => [f, f]), c.funciones[0])}</div></div>
      <button class="btn primary big" id="sinasig">Asignar</button>` : '<p class="meta" style="margin:0">Primero agregá al menos una unidad.</p>'}</div>
  </div>` : ''}
  <div class="section-h"><h3 style="margin:0">Dotación por unidad</h3><span class="demo">${x.dot.length} bombero${x.dot.length === 1 ? '' : 's'}</span></div>
  <div class="unitgrid">${unitCards || '<p class="empty">Sin unidades.</p>'}</div>
  ${fichasBlock(x)}
  <div class="section-h"><h3 style="margin:0">Bitácora</h3></div>
  ${editable ? `<div class="row" style="margin-bottom:10px"><div class="field" style="flex:1 1 300px;margin:0"><label class="label" for="sn_ev">Nuevo evento</label><input id="sn_ev" placeholder="Ej.: 21:40 fuego controlado, se inicia remoción"></div><div class="field" style="flex:0 0 auto;align-self:end;margin:0"><button class="btn outline" id="sinev">Agregar</button></div></div>` : ''}
  <div class="card"><ul class="list">${x.ev.map(e => `<li><span>${esc(e.t)}<br><span class="meta">${esc(e.por ? nice(e.por) : '')}</span></span><span class="meta mono">${fmtD(loc(e.ts))}</span></li>`).join('')}</ul></div>
  ${puede ? vPartes(x) : ''}`;
}

/* ---------- partes de prensa e intervención ---------- */
const PARTE_TIEMPOS = [['aviso', 'Hora de aviso'], ['salida', 'Hora de salida'], ['arribo', 'Hora de arribo'], ['retorno', 'Hora de retorno']];
const PARTE_INT = [['solicitante', 'Quién dio el aviso (nombre y teléfono)', 'input'], ['medio', 'Medio de aviso', 'input'], ['direccion', 'Dirección exacta o coordenadas', 'input'],
  ['relato', 'Descripción de lo actuado', 'area'], ['victimas', 'Víctimas o lesionados (cantidad, estado, traslado)', 'area'], ['involucrados', 'Vehículos, inmuebles o bienes involucrados', 'area'],
  ['danos', 'Daños', 'area'], ['recursos', 'Recursos utilizados (agua, espuma, equipos)', 'area'], ['causa', 'Causa probable', 'input'], ['obsInt', 'Observaciones internas', 'area']];
function parteDe(x){
  if(S.ptDraft && S.ptDraft.sid === x.id) return S.ptDraft.d;
  const p = x.parte || {};
  const d = { fecha: loc(x.creado).slice(0, 10), motivo: x.tipo, direccion: x.dir || '', ...p };
  S.ptDraft = { sid: x.id, d, dirty: false };
  return d;
}
const titulo = w => w.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const nombreParte = n => nombreConGrado(n);
function unidadesParte(x){
  const c = sciCfg();
  return x.unidades.map(u => { const cu = c.unidades.find(z => z.n === u), m = u.match(/\d+/); return (m ? 'N°' + m[0] : u) + (cu && cu.tipo ? ` (${cu.tipo})` : ''); });
}
const listaY = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : (l[0] || '');
function prensaTxt(x, d){
  const c = sciCfg(), u = unidadesParte(x), ef = x.dot.length;
  let obs = u.length ? `Se ${u.length > 1 ? 'movilizan las unidades' : 'moviliza la unidad'} ${listaY(u)}${ef ? ` con ${ef} efectivo${ef === 1 ? '' : 's'}` : ''}` : (ef ? `Intervienen ${ef} efectivos` : '');
  if((d.obsPrensa || '').trim()) obs += (obs ? ' ' : '') + d.obsPrensa.trim();
  obs = obs.replace(/[\s.]*$/, '') + '.';
  const cargo = (d.acargo || '').trim() || (x.cmd ? nombreParte(x.cmd) : '');
  const [y, m, dd] = (d.fecha || '').split('-');
  return [`✓ PARTE DE ALARMA${c.ident ? ` (${c.ident})` : ''}`, d.fecha ? `Fecha: ${dd}/${m}/${y}` : '', d.salida ? `Hora salida: ${d.salida}` : '', d.retorno ? `Hora de retorno: ${d.retorno}` : '',
    `Motivo: ${(d.motivo || x.tipo).trim()}`, (d.ubiPrensa || '').trim() ? `Ubicación: ${d.ubiPrensa.trim()}` : '', `Observaciones: ${obs}`,
    (cargo || d.colaboro) ? `A cargo: ${cargo}${(d.colaboro || '').trim() ? ` - Colaboró: ${d.colaboro.trim()}` : ''}.`.replace(/\.\.$/, '.') : ''].filter(Boolean).join('\n');
}
function vPartes(x){
  if(!S.ptOpen || S.ptOpen !== x.id) return `<div class="section-h"><h3 style="margin:0">Partes</h3></div>
    <div class="card"><p style="margin:0 0 10px">Parte de prensa (texto breve para difundir) y parte de intervención (documento interno o para fiscalía, con croquis).</p><button class="btn primary" data-ptopen="${x.id}">Completar partes</button></div>`;
  const d = parteDe(x), f = (k, l, type = 'input', ph = '') => type === 'area'
    ? `<div class="field"><label class="label" for="pt_${k}">${l}</label><textarea id="pt_${k}" rows="2" placeholder="${esc(ph)}">${esc(d[k] || '')}</textarea></div>`
    : `<div class="field"><label class="label" for="pt_${k}">${l}</label>${type === 'time' ? horaSel('pt_' + k, d[k] || '', true) : `<input id="pt_${k}" ${type === 'date' ? 'type="date"' : ''} value="${esc(d[k] || '')}" placeholder="${esc(ph)}">`}</div>`;
  const adj = x.adj || [];
  return `<div class="section-h"><h3 style="margin:0">Partes</h3><button class="btn small outline" id="ptclose">Cerrar</button></div>
  <div class="grid2 parte">
    <div class="card"><h3>Datos del parte</h3>
      <div class="row">${f('fecha', 'Fecha', 'date')}${PARTE_TIEMPOS.map(([k, l]) => f(k, l, 'time')).join('')}</div>
      <div class="row">${f('motivo', 'Motivo', 'input', 'Ej.: Accidente vehicular')}${f('acargo', 'A cargo (para el parte)', 'input', x.cmd ? nombreParte(x.cmd) : 'Ej.: Sgto. B.V. Alchapar Diego')}</div>
      <span class="label" style="display:block;margin-top:14px">Para prensa · sin datos sensibles</span>
      ${f('ubiPrensa', 'Ubicación aproximada', 'input', 'Ej.: Zona rural (10 km aprox. al Noroeste)')}
      ${f('obsPrensa', 'Observaciones', 'area', 'Ej.: por colisión vehicular. Sin víctimas fatales.')}
      ${f('colaboro', 'Colaboró', 'input', 'Ej.: Sub-Cría Isla Verde')}
      <span class="label" style="display:block;margin-top:14px">Solo parte de intervención (interno)</span>
      ${PARTE_INT.map(([k, l, t]) => f(k, l, t)).join('')}
      <div class="row" style="margin-top:12px"><button class="btn primary" id="ptsave">Guardar datos del parte</button>${S.ptDraft.dirty ? '<span class="pill yellow">Cambios sin guardar</span>' : ''}</div>
    </div>
    <div>
      <div class="card" style="margin-bottom:16px"><h3>Parte de prensa</h3>
        <textarea class="prensa" id="pt_prensa" rows="10">${esc(S.ptPrensa ?? prensaTxt(x, d))}</textarea>
        <p class="demo" style="margin:6px 0 0">Se arma solo con unidades, efectivos y los datos de prensa. No incluye nombres de víctimas, direcciones exactas ni patentes. Podés retocarlo antes de copiarlo.</p>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="ptcopy">Copiar</button><button class="btn outline" id="ptshare">Compartir</button><button class="btn" id="ptregen">Rearmar</button></div></div>
      <div class="card"><h3>Parte de intervención</h3>
        <p style="margin:0 0 8px">PDF completo: horarios, dotación por unidad, bitácora, datos internos, croquis y firmas.</p>
        <span class="label">Croquis o fotos (opcional, hasta 6)</span>
        <div class="adjgrid">${adj.map(j => `<div class="adj"><b>${esc(j.n)}</b><span class="row" style="gap:4px"><button class="btn small" data-adjver="${j.id}">Ver</button><button class="btn small" id="adjdel-${j.id}" data-adjdel="${j.id}">Quitar</button></span></div>`).join('') || '<span class="meta">Sin imágenes.</span>'}</div>
        ${adj.length < 6 ? `<div class="row" style="margin-top:10px"><div class="field" style="margin:0"><label class="label" for="pt_fname">Nombre</label><input id="pt_fname" placeholder="Croquis del lugar"></div>
          <div class="field" style="margin:0"><label class="label" for="pt_file">Imagen (foto del croquis o dibujo)</label><input id="pt_file" type="file" accept="image/*"></div></div>` : ''}
        <button class="btn primary big" id="ptpdf">Descargar parte de intervención (PDF)</button>
        <p class="demo" style="margin:6px 0 0">Guardá los datos antes de descargar: el PDF usa lo guardado.</p></div>
    </div>
  </div>`;
}
async function comprimirImagen(file, max = 1600){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('No se pudo leer la imagen.')); i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    let q = 0.75, d = cv.toDataURL('image/jpeg', q);
    while(d.length > 2400000 && q > 0.3){ q -= 0.1; d = cv.toDataURL('image/jpeg', q); }
    return d;
  } finally { URL.revokeObjectURL(url); }
}
function sciChange(e){
  if(e.target.id !== 'pt_file' || !e.target.files.length) return false;
  adjuntarImagen(e.target.files[0]); return true;
}
async function adjuntarImagen(file){
  const x = sinNow(); if(!x) return;
  try {
    toast('Preparando imagen…');
    const data = await comprimirImagen(file);
    await act('sci_adjuntar', { sid: x.id, nombre: $('#pt_fname')?.value || 'Croquis', data }, 'Imagen adjunta.');
  } catch(err){ toast(err.message); }
}

/* ---------- configuración ---------- */
function vSciCfg(){
  if(!S.sciEdit) S.sciEdit = JSON.parse(JSON.stringify(sciCfg()));
  const E = S.sciEdit;
  return `<p class="lead">Lo que cargues acá lo usan la calculadora y las dotaciones en todos los dispositivos.</p>
  <div class="card" style="margin-bottom:16px"><h3>Generales</h3><div class="row">
    <div class="field"><label class="label" for="sc2_p">Unidad de presión por defecto</label>${sel('sc2_p', [['bar', 'bar'], ['kg', 'kg/cm²'], ['psi', 'psi']], E.presion)}</div>
    <div class="field"><label class="label" for="sc2_t">Metros por tramo de manguera</label><input id="sc2_t" type="number" min="1" max="100" value="${E.tramo}"></div>
    <div class="field"><label class="label" for="sc2_id">Identificación en los partes</label><input id="sc2_id" value="${esc(E.ident || '')}" placeholder="Ej.: Isla Verde 68/8"></div></div></div>
  <div class="card" style="margin-bottom:16px"><h3>Unidades (camiones)</h3>
    <div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Tipo (para el parte)</th><th>Tanque (L)</th><th>Caudal máx. bomba (L/min)</th><th>Presión máx. bomba (bar)</th><th></th></tr></thead><tbody>
    ${E.unidades.map((u, i) => `<tr><td><input class="tin" data-cu="${i}" data-k="n" value="${esc(u.n)}"></td><td><input class="tin" data-cu="${i}" data-k="tipo" value="${esc(u.tipo || '')}" placeholder="Ej.: incendio/rescate"></td><td><input class="tin" type="number" data-cu="${i}" data-k="tanque" value="${u.tanque ?? ''}"></td>
      <td><input class="tin" type="number" data-cu="${i}" data-k="caudal" value="${u.caudal ?? ''}"></td><td><input class="tin" type="number" step="0.5" data-cu="${i}" data-k="pmax" value="${u.pmax ?? ''}"></td>
      <td><button class="btn small" data-cudel="${i}">Quitar</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Todavía no hay unidades cargadas.</td></tr>'}
    </tbody></table></div><button class="btn outline" style="margin-top:10px" id="cuadd">Agregar unidad</button></div>
  <div class="card" style="margin-bottom:16px"><h3>Mangueras y coeficiente de pérdida</h3>
    <p class="meta" style="margin:0 0 8px">Coeficiente C de la fórmula IFSTA (psi, gpm, cada 100 pies). Si el fabricante da otro valor, cargalo acá.</p>
    <div class="tablewrap"><table><thead><tr><th>Manguera</th><th>Coeficiente C</th><th></th></tr></thead><tbody>
    ${E.mangueras.map((m, i) => `<tr><td><input class="tin" data-cm="${i}" data-k="n" value="${esc(m.n)}"></td><td><input class="tin" type="number" step="0.01" data-cm="${i}" data-k="c" value="${m.c}"></td><td><button class="btn small" data-cmdel="${i}">Quitar</button></td></tr>`).join('')}
    </tbody></table></div><button class="btn outline" style="margin-top:10px" id="cmadd">Agregar manguera</button></div>
  <div class="card" style="margin-bottom:16px"><h3>Funciones en la dotación</h3>
    <div class="field"><label class="label" for="sc2_f">Una por línea</label><textarea id="sc2_f" rows="8">${esc(E.funciones.join('\n'))}</textarea></div></div>
  <div class="row"><button class="btn primary big" id="scisave">Guardar configuración</button><button class="btn" id="scireset">Descartar cambios</button></div>`;
}
function sciCfgCollect(){
  const E = S.sciEdit; if(!E) return;
  document.querySelectorAll('[data-cu]').forEach(el => { const u = E.unidades[+el.dataset.cu]; if(u) u[el.dataset.k] = ['n', 'tipo'].includes(el.dataset.k) ? el.value : (el.value === '' ? null : +el.value); });
  document.querySelectorAll('[data-cm]').forEach(el => { const m = E.mangueras[+el.dataset.cm]; if(m) m[el.dataset.k] = el.dataset.k === 'n' ? el.value : +el.value; });
  const p = $('#sc2_p'), t = $('#sc2_t'), f = $('#sc2_f');
  if(p) E.presion = p.value; if(t) E.tramo = +t.value || 20;
  const id = $('#sc2_id'); if(id) E.ident = id.value.trim();
  if(f) E.funciones = f.value.split('\n').map(x => x.trim()).filter(Boolean);
}

/* ---------- acciones ---------- */
const sinNow = () => (S.sci?.siniestros || []).find(x => x.id === S.sciSel);
async function sciAction(t){
  const d = t.dataset;
  if(d.scitab){ S.sciTab = d.scitab; S.sciEdit = null; render(); if(d.scitab === 'dot' && sess().step === 'me') reload(); return true; }
  if(S.tab !== 'sci') return false;
  if(t.id === 'sinnew'){ S.sinNew = !S.sinNew; render(); return true; }
  if(t.id === 'sinreload'){ await reload(); return true; }
  if(t.id === 'sinpast'){ S.sinPast = !S.sinPast; render(); return true; }
  if(d.sinsel){ S.sciSel = +d.sinsel; S.sinReasign = false; render(); window.scrollTo(0, 0); return true; }
  if(t.id === 'sinback'){ S.sciSel = null; S.fichas = null; render(); return true; }
  if(t.id === 'sincreate'){
    const id = await act('sci_crear', { tipo: $('#sn_tipo').value, direccion: $('#sn_dir').value, notas: $('#sn_notas').value }, 'Siniestro abierto. Agregá las unidades y la dotación.');
    if(id){ S.sinNew = false; S.sciSel = +id; render(); } return true;
  }
  const x = sinNow();
  if(!x) return false;
  const edit = (cambios, msg) => act('sci_editar', { sid: x.id, tipo: x.tipo, direccion: x.dir, notas: x.notas,
    comandante: (active().find(p => p.n === x.cmd) || {}).id || null, unidades: x.unidades, ...cambios }, msg);
  if(d.fichas){ try { S.fichas = { sid: x.id, rows: await call('sci_fichas', { sid: x.id }) }; render(); } catch(e){} return true; }
  if(t.id === 'fichasoff'){ S.fichas = null; render(); return true; }
  if(t.id === 'sinunadd'){ const u = $('#sn_unit').value.trim(); if(!u){ toast('Escribí o elegí la unidad.'); return true; }
    if(x.unidades.includes(u)){ toast('Esa unidad ya está en el siniestro.'); return true; }
    await edit({ unidades: [...x.unidades, u] }, `${u} agregada.`); return true; }
  if(d.sinunq){ const crew = x.dot.filter(z => z.u === d.sinunq).length;
    if(crew && !confirmTwice(t, `Tiene ${crew} asignado${crew > 1 ? 's' : ''}. Tocá de nuevo para quitarla.`)) return true;
    await edit({ unidades: x.unidades.filter(u => u !== d.sinunq) }, `${d.sinunq} retirada.`); return true; }
  if(t.id === 'sincmd'){ const v = $('#sn_cmd').value; await edit({ comandante: v ? +v : null }, 'A cargo actualizado.'); return true; }
  if(t.id === 'sinasig'){ const pid = $('#sn_per').value; if(!pid){ toast('Elegí el bombero.'); return true; }
    await act('sci_asignar', { sid: x.id, persona: +pid, unidad: $('#sn_u').value, funcion: $('#sn_f').value }, 'Asignado.'); return true; }
  if(d.sinquit){ const p = member(d.sinquit); await act('sci_quitar', { sid: x.id, persona: p.id }, `${d.sinquit} sale de la dotación.`); return true; }
  if(t.id === 'sinev'){ const v = $('#sn_ev').value.trim(); if(!v){ toast('Escribí el evento.'); return true; }
    await act('sci_evento', { sid: x.id, texto: v }, 'Evento agregado a la bitácora.'); return true; }
  if(t.id === 'sinnotif'){ await act('sci_notificar', { sid: x.id }, n => `Aviso enviado a ${n} bombero${n == 1 ? '' : 's'} con avisos activados.`); return true; }
  if(t.id === 'sinclose'){ if(!confirmTwice(t, 'Tocá de nuevo para cerrar el siniestro.')) return true;
    await act('sci_estado', { sid: x.id, cerrar: true }, 'Siniestro cerrado.'); return true; }
  if(t.id === 'sinopen'){ await act('sci_estado', { sid: x.id, cerrar: false }, 'Siniestro reabierto.'); return true; }
  if(d.ptopen){ S.ptOpen = x.id; S.ptDraft = null; S.ptPrensa = null; render(); return true; }
  if(t.id === 'ptclose'){ if(S.ptDraft?.dirty && !confirmTwice(t, 'Hay cambios sin guardar. Tocá de nuevo para cerrar igual.')) return true; S.ptOpen = null; S.ptDraft = null; S.ptPrensa = null; render(); return true; }
  if(t.id === 'ptsave'){ const datos = { ...parteDe(x) };
    if(await act('sci_parte', { sid: x.id, datos }, 'Datos del parte guardados.')){ S.ptDraft = null; render(); } return true; }
  if(t.id === 'ptregen'){ S.ptPrensa = null; const o = $('#pt_prensa'); if(o) o.value = prensaTxt(x, parteDe(x)); return true; }
  if(t.id === 'ptcopy'){ const v = $('#pt_prensa').value; navigator.clipboard.writeText(v).then(() => toast('Parte de prensa copiado.'), () => { $('#pt_prensa').select(); toast('Copialo con Ctrl+C.'); }); return true; }
  if(t.id === 'ptshare'){ const v = $('#pt_prensa').value;
    if(navigator.share){ navigator.share({ text: v }).catch(() => {}); } else window.open('https://wa.me/?text=' + encodeURIComponent(v), '_blank'); return true; }
  if(d.adjver){ try { const data = await call('sci_adjunto', { aid: +d.adjver }); if(!data) return true;
      const b = await (await fetch(data)).blob(), u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch(e){} return true; }
  if(d.adjdel){ if(!confirmTwice(t, 'Tocá de nuevo para quitar la imagen.')) return true; await act('sci_adjunto_borrar', { aid: +d.adjdel }, 'Imagen quitada.'); return true; }
  if(t.id === 'ptpdf'){ if(S.ptDraft?.dirty){ toast('Primero guardá los datos del parte.'); return true; } pdfIntervencion(sess().who, x); return true; }
  return false;
}
async function sciCfgAction(t){
  if(S.tab !== 'sci' || S.sciTab !== 'cfg') return false;
  const d = t.dataset, E = S.sciEdit; if(!E) return false;
  sciCfgCollect();
  if(t.id === 'cuadd'){ E.unidades.push({ n: `Unidad ${E.unidades.length + 1}`, tipo: '', tanque: null, caudal: null, pmax: null }); render(); return true; }
  if(d.cudel !== undefined){ E.unidades.splice(+d.cudel, 1); render(); return true; }
  if(t.id === 'cmadd'){ E.mangueras.push({ n: 'Nueva manguera', c: 1 }); render(); return true; }
  if(d.cmdel !== undefined){ if(E.mangueras.length <= 1){ toast('Tiene que quedar al menos una manguera.'); return true; } E.mangueras.splice(+d.cmdel, 1); render(); return true; }
  if(t.id === 'scireset'){ S.sciEdit = null; render(); return true; }
  if(t.id === 'scisave'){
    if(E.unidades.some(u => !String(u.n || '').trim())){ toast('Cada unidad necesita nombre.'); return true; }
    if(E.mangueras.some(m => !String(m.n || '').trim() || !(m.c > 0))){ toast('Cada manguera necesita nombre y un coeficiente mayor a 0.'); return true; }
    if(!E.funciones.length){ toast('Cargá al menos una función.'); return true; }
    if(await act('guardar_sci', { datos: E }, 'Configuración SCI guardada.')){ S.sciEdit = null; S.hyd = null; render(); }
    return true;
  }
  return false;
}
// Para acciones delicadas: el primer toque avisa, el segundo confirma.
function confirmTwice(btn, msg){
  const k = btn.id + (btn.dataset.sinunq || '');
  if(confirmTwice.k === k && Date.now() - confirmTwice.t < 4000){ confirmTwice.k = null; return true; }
  confirmTwice.k = k; confirmTwice.t = Date.now(); toast(msg); return false;
}
