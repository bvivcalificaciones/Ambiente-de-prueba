/* =====================================================================
   EPP · Equipos de protección personal
    · Cada bombero pide un equipo con su talle.
    · Aprueban jefatura y superiores (los superiores, su guardia). Nadie se aprueba a sí mismo.
    · Queda el historial completo de cada pedido.
    · Equipamiento: lo que tiene cada bombero, con fecha de fabricación y vida útil.
      Rojo vencido, naranja vence en menos de un año, verde vigente (NFPA 1851: estructurales 10 años).
   ===================================================================== */
const MOTIVOS_EPP = ['Primera entrega', 'Reposición por desgaste', 'Rotura', 'Pérdida', 'Cambio de talle', 'Otro'];
const EPP_ST = { pendiente: ['Pendiente', 'yellow'], aprobada: ['Aprobada · a entregar', 'green'], entregada: ['Entregada', 'dark'], rechazada: ['Rechazada', 'red'], cancelada: ['Cancelada', ''] };
const eppPill = e => `<span class="pill ${EPP_ST[e][1]}">${EPP_ST[e][0]}</span>`;

function vEPP(){
  const s = sess();
  if(s.step === 'pin') return vPin('Ingresá tu PIN', nice(s.who));
  if(s.step === 'newpin') return vNewPin();
  if(s.step !== 'me') return vWho('EPP', 'Pedí equipos de protección personal con tu talle y seguí el estado de tus pedidos.', active());
  const v = s.who, D = S.epp || { catalogo: [], mias: [], otras: [] };
  const pend = D.otras.filter(x => x.estado === 'pendiente').length, entr = D.otras.filter(x => x.estado === 'aprobada').length;
  const venc = (D.invTodos || []).filter(x => x.estado === 'en_uso' && ['venc', 'prox'].includes(eppSem(x).c)).length;
  const tabs = [['mis', 'Mis pedidos'], ['eq', 'Mi equipamiento'], ...(D.aprueba ? [['apr', `Aprobar${pend + entr ? ` (${pend + entr})` : ''}`], ['inv', `Equipamiento${venc ? ` (${venc})` : ''}`], ['his', 'Historial']] : []), ...(D.edita ? [['cat', 'Catálogo']] : [])];
  if(!tabs.some(([k]) => k === S.eppTab)) S.eppTab = 'mis';
  const head = `<div class="who"><div><span class="label">${esc(nice(v))} · Equipos de protección personal</span><h2>EPP</h2></div><button class="btn outline small" id="bye">Salir</button></div>
    ${tabs.length > 1 ? `<div class="seg" role="tablist">${tabs.map(([k, l]) => `<button data-epptab="${k}" aria-selected="${S.eppTab === k}">${l}</button>`).join('')}</div>` : ''}`;
  if(S.eppTab === 'apr') return head + vEppAprobar(D);
  if(S.eppTab === 'eq') return head + vEppMiEquipo(D);
  if(S.eppTab === 'inv') return head + (S.eppPer ? vEppPersona(D) : vEppInventario(D));
  if(S.eppTab === 'his') return head + vEppHistorial(D);
  if(S.eppTab === 'cat') return head + vEppCatalogo(D);
  return head + vEppMios(D);
}
function eppTimeline(x){
  return `<ol class="tl">${x.ev.map(e => `<li><b>${esc(e.a)}</b> <span class="meta">${fmtD(loc(e.ts))} · ${esc(e.por ? nice(e.por) : '')}</span>${e.nota ? `<br><span>${esc(e.nota)}</span>` : ''}</li>`).join('')}</ol>`;
}
function eppRow(x, who, extra = ''){
  return `<li class="epprow"><div class="eppmain"><span><b>${x.cant} × ${esc(x.item)}</b> · talle <b>${esc(x.talle)}</b>${who ? `<br><span class="meta">${esc(x.n)} · ${x.cargo ? esc(x.cargo) : x.g ? 'Guardia ' + x.g : 'Sin guardia'}</span>` : ''}
      <br><span class="meta">${esc(x.motivo)}${x.obs ? ' · ' + esc(x.obs) : ''} · pedido ${fmtD(loc(x.creado))}</span></span><span class="eppside">${eppPill(x.estado)}${extra}</span></div>
    <details><summary>Historial del pedido</summary>${eppTimeline(x)}</details></li>`;
}
function vEppMios(D){
  if(!S.eppForm) S.eppForm = { item: '', talle: '', cant: 1, motivo: '' };
  const F = S.eppForm, it = D.catalogo.find(c => c.n === F.item);
  if(it && it.t.length === 1) F.talle = it.t[0];
  const ultimo = F.item && D.mias.find(x => x.item === F.item);
  return `<div class="grid2">
  <div class="card"><h3>Nuevo pedido</h3>
    <span class="label">Equipo</span>
    <div class="chips" style="margin:6px 0 10px">${D.catalogo.map(c => `<button class="chip" data-eppitem="${esc(c.n)}" aria-pressed="${F.item === c.n}">${esc(c.n)}</button>`).join('')}</div>
    ${it ? `<span class="label">Talle${ultimo ? ` · la última vez pediste ${esc(ultimo.talle)}` : ''}</span>
    <div class="chips" style="margin:6px 0 10px">${it.t.map(t => `<button class="chip" data-epptalle="${esc(t)}" aria-pressed="${F.talle === t}">${esc(t)}</button>`).join('')}</div>
    <div class="row">
      <div class="field"><label class="label" for="ep_cant">Cantidad</label><input id="ep_cant" type="number" min="1" max="10" value="${F.cant}" inputmode="numeric"></div>
      <div class="field"><label class="label" for="ep_mot">Motivo</label><select id="ep_mot"><option value="">Elegir…</option>${MOTIVOS_EPP.map(m => `<option ${F.motivo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label class="label" for="ep_obs">Detalle (opcional)</label><input id="ep_obs" placeholder="Ej.: la suela está despegada"></div>
    <button class="btn primary big" id="eppsend" ${F.talle ? '' : 'disabled'}>Enviar pedido</button>` : '<p class="meta" style="margin:0">Elegí el equipo para ver los talles.</p>'}
  </div>
  <div class="card"><h3>Mis pedidos</h3>
    <ul class="list epplist">${D.mias.map(x => eppRow(x, false, x.estado === 'pendiente' ? `<button class="btn small" data-eppcancel="${x.id}">Cancelar</button>` : '')).join('') || '<li class="empty">Todavía no hiciste pedidos.</li>'}</ul></div>
  </div>`;
}
function vEppAprobar(D){
  const pend = D.otras.filter(x => x.estado === 'pendiente'), entr = D.otras.filter(x => x.estado === 'aprobada');
  const card = (x, acciones) => `<div class="card eppcard">${eppRow(x, true).replace('<li class="epprow">', '<div class="epprow">').replace(/<\/li>$/, '</div>')}${acciones}</div>`;
  return `<div class="section-h" style="margin-top:0"><h3 style="margin:0">Pendientes de aprobar · ${pend.length}</h3></div>
  <div class="eppgrid">${pend.map(x => card(x, S.eppRej === x.id
      ? `<div class="field"><label class="label" for="ep_nota">Motivo del rechazo</label><input id="ep_nota" placeholder="Ej.: se entregó hace 2 meses"></div>
         <div class="row" style="margin-top:8px"><button class="btn primary" data-eppact="rechazar" data-eppid="${x.id}">Confirmar rechazo</button><button class="btn" id="eppnorej">Volver</button></div>`
      : `<div class="field"><label class="label" for="ep_n${x.id}">Nota (opcional)</label><input id="ep_n${x.id}" placeholder="Ej.: retirar en depósito el sábado"></div>
         <div class="row" style="margin-top:8px"><button class="btn go" data-eppact="aprobar" data-eppid="${x.id}">Aprobar</button><button class="btn outline" data-epprej="${x.id}">Rechazar</button></div>`)).join('') || '<p class="empty">No hay pedidos pendientes.</p>'}</div>
  <div class="section-h"><h3 style="margin:0">Aprobados para entregar · ${entr.length}</h3></div>
  <div class="eppgrid">${entr.map(x => card(x, S.eppEnt === x.id ? vEppEntregaForm(x, D)
      : `<div class="row" style="margin-top:8px"><button class="btn primary" data-eppent="${x.id}">Registrar entrega</button></div>`)).join('') || '<p class="empty">Nada para entregar.</p>'}</div>`;
}
function vEppHistorial(D){
  const f = S.eppFil || (S.eppFil = { estado: '', item: '', q: '' });
  const rows = D.otras.filter(x => (!f.estado || x.estado === f.estado) && (!f.item || x.item === f.item) && (!f.q || x.n.toLowerCase().includes(f.q.toLowerCase())));
  const items = [...new Set(D.otras.map(x => x.item))].sort();
  return `<div class="filters">
    <div class="field"><label class="label" for="ef_q">Bombero</label><input id="ef_q" value="${esc(f.q)}" placeholder="Apellido"></div>
    <div class="field"><label class="label" for="ef_e">Estado</label><select id="ef_e"><option value="">Todos</option>${Object.keys(EPP_ST).map(k => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${EPP_ST[k][0]}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="ef_i">Equipo</label><select id="ef_i"><option value="">Todos</option>${items.map(i => `<option ${f.item === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></div>
    <button class="btn small outline" id="eppxls">Descargar Excel</button>
  </div>
  <p class="meta">${rows.length} pedido${rows.length === 1 ? '' : 's'}. Tocá "Historial del pedido" para ver quién lo aprobó y cuándo.</p>
  <ul class="list epplist card">${rows.map(x => eppRow(x, true)).join('') || '<li class="empty">Sin pedidos con esos filtros.</li>'}</ul>`;
}
function vEppCatalogo(D){
  if(!S.eppCat) S.eppCat = D.catalogo.map(c => ({ n: c.n, t: c.t.join(', '), v: c.v ?? '' }));
  return `<p class="lead">Los talles van separados por coma. La vida útil (en años, desde la fecha de fabricación) define cuándo vence cada equipo; dejala vacía si no vence. Los pedidos anteriores conservan el nombre y el talle con que se hicieron.</p>
  <div class="card"><div class="tablewrap"><table><thead><tr><th>Equipo</th><th>Talles</th><th>Vida útil (años)</th><th></th></tr></thead><tbody>
  ${S.eppCat.map((c, i) => `<tr><td><input class="tin" data-ec="${i}" data-k="n" value="${esc(c.n)}"></td><td><input class="tin wide" data-ec="${i}" data-k="t" value="${esc(c.t)}"></td><td><input class="tin" style="min-width:70px" type="number" min="1" max="50" data-ec="${i}" data-k="v" value="${esc(c.v)}" placeholder="No vence"></td><td><button class="btn small" data-ecdel="${i}">Quitar</button></td></tr>`).join('')}
  </tbody></table></div>
  <div class="row" style="margin-top:12px"><button class="btn outline" id="ecadd">Agregar equipo</button><button class="btn primary" id="ecsave">Guardar catálogo</button><button class="btn" id="ecreset">Descartar cambios</button></div></div>`;
}
function eppCatCollect(){ document.querySelectorAll('[data-ec]').forEach(el => { const c = S.eppCat[+el.dataset.ec]; if(c) c[el.dataset.k] = el.value; }); }

async function eppAction(t){
  if(S.tab !== 'epp') return false;
  const d = t.dataset;
  if(d.epptab){ S.eppTab = d.epptab; S.eppRej = null; S.eppCat = null; S.eppPer = null; S.eppInvEd = null; S.eppEnt = null; render(); return true; }
  if(await eppInvAction(t)) return true;
  if(d.eppitem){ S.eppForm.item = S.eppForm.item === d.eppitem ? '' : d.eppitem; S.eppForm.talle = ''; render(); return true; }
  if(d.epptalle){ eppKeep(); S.eppForm.talle = d.epptalle; render(); return true; }
  if(t.id === 'eppsend'){
    eppKeep(); const F = S.eppForm;
    if(!F.motivo){ toast('Elegí el motivo.'); return true; }
    if(await act('epp_solicitar', { item: F.item, talle: F.talle, cantidad: +F.cant || 1, motivo: F.motivo, obs: $('#ep_obs').value }, 'Pedido enviado. Te avisamos cuando lo aprueben.')){
      S.eppForm = null; render(); }
    return true;
  }
  if(d.eppcancel){ await act('epp_resolver', { sid: +d.eppcancel, accion: 'cancelar', nota: null }, 'Pedido cancelado.'); return true; }
  if(d.epprej){ S.eppRej = +d.epprej; render(); return true; }
  if(t.id === 'eppnorej'){ S.eppRej = null; render(); return true; }
  if(d.eppact){
    const id = +d.eppid, nota = d.eppact === 'rechazar' ? $('#ep_nota')?.value : $('#ep_n' + id)?.value;
    const msg = { aprobar: 'Pedido aprobado.', rechazar: 'Pedido rechazado.', entregar: 'Entrega registrada.' }[d.eppact];
    if(await act('epp_resolver', { sid: id, accion: d.eppact, nota: nota || null }, msg)){ S.eppRej = null; render(); }
    return true;
  }
  if(t.id === 'eppxls'){
    if(typeof XLSX === 'undefined'){ toast('No se pudo cargar el generador de Excel. Revisá la conexión.'); return true; }
    const f = S.eppFil || {}, rows = (S.epp.otras || []).filter(x => (!f.estado || x.estado === f.estado) && (!f.item || x.item === f.item) && (!f.q || x.n.toLowerCase().includes(f.q.toLowerCase())));
    const ev = (x, a) => x.ev.filter(e => e.a === a).pop();
    const data = rows.map(x => { const ap = ev(x, 'Aprobada') || ev(x, 'Rechazada'), en = ev(x, 'Entregada');
      return { Pedido: fmtD(loc(x.creado)), Bombero: x.n, Ubicación: x.cargo || (x.g ? 'Guardia ' + x.g : 'Sin guardia'), Equipo: x.item, Talle: x.talle, Cantidad: x.cant,
        Motivo: x.motivo, Detalle: x.obs || '', Estado: EPP_ST[x.estado][0], 'Resolvió': ap ? nice(ap.por || '') : '', 'Fecha resolución': ap ? fmtD(loc(ap.ts)) : '',
        'Nota': ap?.nota || '', 'Entregó': en ? nice(en.por || '') : '', 'Fecha entrega': en ? fmtD(loc(en.ts)) : '' }; });
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Pedido: 'Sin pedidos' }]);
    ws['!cols'] = [12, 26, 14, 26, 10, 9, 22, 30, 18, 22, 14, 30, 22, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos de EPP'); XLSX.writeFile(wb, `EPP_historial_${dstr(new Date())}.xlsx`);
    toast('Excel descargado.'); return true;
  }
  if(t.id === 'ecadd' || t.id === 'ecsave' || t.id === 'ecreset' || d.ecdel !== undefined){
    eppCatCollect();
    if(t.id === 'ecadd'){ S.eppCat.push({ n: '', t: 'Única', v: '' }); render(); return true; }
    if(d.ecdel !== undefined){ S.eppCat.splice(+d.ecdel, 1); render(); return true; }
    if(t.id === 'ecreset'){ S.eppCat = null; render(); return true; }
    const items = S.eppCat.map(c => ({ n: c.n.trim(), t: c.t.split(',').map(x => x.trim()).filter(Boolean), v: String(c.v).trim() === '' ? null : Math.round(+c.v) }));
    if(items.some(i => i.v != null && !(i.v >= 1 && i.v <= 50))){ toast('La vida útil va de 1 a 50 años (o vacía si no vence).'); return true; }
    if(!items.length || items.some(i => i.n.length < 2 || !i.t.length)){ toast('Cada equipo necesita nombre y al menos un talle.'); return true; }
    if(new Set(items.map(i => i.n.toLowerCase())).size !== items.length){ toast('Hay dos equipos con el mismo nombre.'); return true; }
    if(await act('guardar_epp_catalogo', { items }, 'Catálogo guardado.')){ S.eppCat = null; render(); }
    return true;
  }
  return false;
}
function eppKeep(){ const c = $('#ep_cant'), m = $('#ep_mot'); if(c) S.eppForm.cant = c.value; if(m) S.eppForm.motivo = m.value; }
function eppChange(e){
  const id = e.target.id;
  if(id === 'ef_e' || id === 'ef_i'){ S.eppFil[id === 'ef_e' ? 'estado' : 'item'] = e.target.value; render(); return true; }
  if(id === 'iv_prec' || id === 'en_prec' || id === 'iv_item'){ eppInvCollect(); render(); return true; }
  if(id === 'if_solo' || id === 'if_g'){ S.eppIF[id === 'if_solo' ? 'solo' : 'g'] = id === 'if_solo' ? e.target.checked : e.target.value; render(); return true; }
  if(id === 'ep_cant' || id === 'ep_mot'){ eppKeep(); return true; }
  return false;
}

/* =====================================================================
   Equipamiento de cada bombero (inventario) y vencimientos
   ===================================================================== */
const PREC = [['anio', 'Solo el año'], ['mes', 'Mes y año'], ['dia', 'Fecha exacta']];
function eppVence(x){ if(!x.fab || !x.vida) return null; const d = P(x.fab); d.setFullYear(d.getFullYear() + (+x.vida)); return d; }
function eppSem(x){
  if(!x.vida) return { c: 'na', t: 'No vence' };
  if(!x.fab) return { c: 'sd', t: 'Sin fecha' };
  const dias = (eppVence(x) - new Date()) / 864e5;
  if(dias <= 0) return { c: 'venc', t: 'Vencido' };
  if(dias < 365) return { c: 'prox', t: dias < 62 ? `Vence en ${Math.ceil(dias)} días` : `Vence en ${Math.round(dias / 30.44)} meses` };
  return { c: 'ok', t: 'Vigente' };
}
const fabTxt = x => { if(!x.fab) return 'Sin fecha'; const [y, m, d] = x.fab.split('-'); return x.prec === 'anio' ? y : x.prec === 'mes' ? `${m}/${y}` : `${d}/${m}/${y}`; };
const venceTxt = x => { const v = eppVence(x); if(!v) return ''; return x.prec === 'anio' ? String(v.getFullYear()) : x.prec === 'mes' ? `${pad(v.getMonth() + 1)}/${v.getFullYear()}` : `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`; };
const semPill = x => { const s = eppSem(x); return `<span class="pill ev-${s.c}">${s.t}</span>`; };
const invLegend = () => `<div class="invlegend"><span><i class="ev-venc"></i>Vencido</span><span><i class="ev-prox"></i>Vence en menos de 1 año</span><span><i class="ev-ok"></i>Vigente</span><span><i class="ev-sd"></i>Sin fecha de fabricación</span><span><i class="ev-na"></i>No vence</span><span>— No tiene</span></div>`;

function eqCard(x, gestiona){
  const vt = venceTxt(x);
  return `<div class="eqcard ${x.estado === 'baja' ? 'baja' : ''}"><div class="top"><b>${esc(x.item)}</b>${x.estado === 'baja' ? '<span class="pill">De baja</span>' : semPill(x)}</div>
    <span class="meta">Talle ${esc(x.talle || 's/d')}${x.cant > 1 ? ` · ${x.cant} unidades` : ''} · fabricación ${fabTxt(x)}${x.vida ? ` · vida útil ${x.vida} años${vt ? ` (vence ${vt})` : ''}` : ''}</span>
    ${x.ent ? `<span class="meta">Entregado ${fechaCorta(x.ent)}</span>` : ''}${x.nota ? `<span class="meta">${esc(x.nota)}</span>` : ''}
    ${x.estado === 'baja' ? `<span class="meta">Baja ${x.bajaF ? fechaCorta(x.bajaF) : ''}: ${esc(x.bajaMot || '')}</span>` : ''}
    ${gestiona && x.estado !== 'baja' ? (S.eppBaja === x.id
      ? `<div class="field" style="margin-top:6px"><label class="label" for="ib_mot">Motivo de la baja</label><input id="ib_mot" placeholder="Ej.: vencido, roto, devuelto"></div><div class="row" style="margin-top:6px"><button class="btn small primary" data-ivbajaok="${x.id}">Dar de baja</button><button class="btn small" id="ivbajano">No</button></div>`
      : `<div class="row" style="margin-top:6px;gap:6px"><button class="btn small outline" data-ived="${x.id}">Corregir</button><button class="btn small" data-ivbaja="${x.id}">Dar de baja</button></div>`) : ''}</div>`;
}
const fechaCorta = s => { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

function vEppMiEquipo(D){
  const inv = (D.inv || []).filter(x => x.estado === 'en_uso'), bajas = (D.inv || []).filter(x => x.estado === 'baja');
  const alerta = inv.filter(x => ['venc', 'prox'].includes(eppSem(x).c));
  return `${alerta.length ? `<div class="card alert" style="margin-bottom:14px"><h3>Atención</h3><p style="margin:0">${alerta.map(x => `<b>${esc(x.item)}</b>: ${eppSem(x).t.toLowerCase()}`).join(' · ')}. Pedí el reemplazo desde "Mis pedidos".</p></div>` : ''}
  <div class="eqgrid">${inv.map(x => eqCard(x, false)).join('') || '<p class="empty">Todavía no hay equipamiento cargado a tu nombre.</p>'}</div>
  ${invLegend()}
  ${bajas.length ? `<details style="margin-top:16px"><summary class="label">Dados de baja · ${bajas.length}</summary><div class="eqgrid" style="margin-top:8px">${bajas.map(x => eqCard(x, false)).join('')}</div></details>` : ''}
  <p class="demo" style="margin-top:14px">Si algo no coincide con lo que tenés, avisale a tu superior para que lo corrija.</p>`;
}

function invColumns(D){
  const used = new Set((D.invTodos || []).filter(x => x.estado === 'en_uso').map(x => x.item));
  const cols = D.catalogo.map(c => c.n).filter(n => used.has(n));
  for(const n of used) if(!cols.includes(n)) cols.push(n);
  return cols;
}
function invRows(D){
  const f = S.eppIF || (S.eppIF = { q: '', g: '', solo: false });
  const by = new Map();
  for(const x of (D.invTodos || [])) if(x.estado === 'en_uso'){ if(!by.has(x.pid)) by.set(x.pid, []); by.get(x.pid).push(x); }
  return (D.personas || []).map(p => { const m = member(p.n) || {}; return { id: p.id, n: p.n, g: m.g, cargo: m.cargo, items: by.get(p.id) || [] }; })
    .filter(r => (!f.q || r.n.toLowerCase().includes(f.q.toLowerCase())) && (!f.g || (f.g === 'j' ? r.cargo : !r.cargo && String(r.g || 0) === f.g))
      && (!f.solo || r.items.some(x => ['venc', 'prox'].includes(eppSem(x).c))));
}
function vEppInventario(D){
  const f = S.eppIF || (S.eppIF = { q: '', g: '', solo: false });
  const cols = invColumns(D), rows = invRows(D), all = (D.invTodos || []).filter(x => x.estado === 'en_uso');
  const cnt = c => all.filter(x => eppSem(x).c === c).length;
  const worst = list => { const o = ['venc', 'prox', 'sd', 'ok', 'na']; return list.slice().sort((a, b) => o.indexOf(eppSem(a).c) - o.indexOf(eppSem(b).c))[0]; };
  const cell = (r, it) => { const xs = r.items.filter(x => x.item === it); if(!xs.length) return '<td class="ic no"><span>—</span></td>';
    const x = worst(xs), s = eppSem(x); return `<td class="ic"><span class="ev-${s.c}" title="${esc(s.t)}">${x.fab ? fabTxt(x) : 'S/F'}<small>${esc(x.talle || 's/d')}${xs.length > 1 ? ` · ${xs.length}` : ''}</small></span></td>`; };
  return `<div class="kpis">
    <div class="kpi" style="border-top-color:var(--red)"><div class="n">${cnt('venc')}</div><div class="k">equipos vencidos</div></div>
    <div class="kpi" style="border-top-color:#f08a24"><div class="n">${cnt('prox')}</div><div class="k">vencen en menos de un año</div></div>
    <div class="kpi" style="border-top-color:var(--green)"><div class="n">${cnt('ok')}</div><div class="k">vigentes</div></div>
    <div class="kpi warn"><div class="n">${cnt('sd')}</div><div class="k">sin fecha de fabricación</div></div></div>
  <div class="filters">
    <div class="field"><label class="label" for="if_q">Bombero</label><input id="if_q" value="${esc(f.q)}" placeholder="Apellido"></div>
    <div class="field"><label class="label" for="if_g">Ubicación</label><select id="if_g"><option value="">Todos</option>${[['1', 'Guardia 1'], ['2', 'Guardia 2'], ['0', 'Sin guardia'], ['j', 'Jefatura']].map(([v, t]) => `<option value="${v}" ${f.g === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <label class="check" style="margin:0 0 12px"><input type="checkbox" id="if_solo" ${f.solo ? 'checked' : ''}> Solo con vencidos o por vencer</label>
    <button class="btn small outline" id="invxls">Descargar Excel</button>
  </div>
  <div class="tablewrap"><table class="invtable"><thead><tr><th>Bombero / Aspirante</th>${cols.map(c => `<th class="c">${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr class="click" data-ivper="${r.id}"><td><b>${esc(r.n)}</b><br><span class="meta">${r.cargo ? esc(r.cargo) : r.g ? 'Guardia ' + r.g : 'Sin guardia'}</span></td>${cols.map(c => cell(r, c)).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty">Sin resultados.</td></tr>`}</tbody></table></div>
  ${invLegend()}
  <p class="demo" style="margin-top:8px">Cada celda muestra la fecha de fabricación y el talle. Tocá a una persona para ver, corregir o agregar su equipamiento. Si la planilla tenía solo el mes o el año, el vencimiento se cuenta desde el día 1 de ese mes o de enero.</p>`;
}
function vEppPersona(D){
  const p = (D.personas || []).find(x => x.id === S.eppPer); if(!p){ S.eppPer = null; return vEppInventario(D); }
  const inv = (D.invTodos || []).filter(x => x.pid === p.id), act = inv.filter(x => x.estado === 'en_uso'), bajas = inv.filter(x => x.estado === 'baja');
  return `<button class="linkbtn" id="ivback" style="display:block;margin:2px 0 8px">← Volver a la tabla</button>
  <div class="section-h" style="margin-top:0"><h3 style="margin:0">${esc(p.n)}</h3>${S.eppInvEd ? '' : '<button class="btn primary" id="ivadd">Agregar equipo</button>'}</div>
  ${S.eppInvEd ? vEppInvForm(D, p) : ''}
  <div class="eqgrid">${act.map(x => eqCard(x, true)).join('') || '<p class="empty">Sin equipamiento cargado.</p>'}</div>${invLegend()}
  ${bajas.length ? `<details style="margin-top:16px"><summary class="label">Dados de baja · ${bajas.length}</summary><div class="eqgrid" style="margin-top:8px">${bajas.map(x => eqCard(x, false)).join('')}</div></details>` : ''}`;
}
function fabInput(id, prec, fab){
  const v = fab || '';
  if(prec === 'anio') return `<input id="${id}" type="number" min="1980" max="${new Date().getFullYear()}" placeholder="Ej.: 2018" value="${v ? v.slice(0, 4) : ''}" inputmode="numeric">`;
  if(prec === 'mes') return `<input id="${id}" type="month" value="${v ? v.slice(0, 7) : ''}">`;
  return `<input id="${id}" type="date" value="${v ? v.slice(0, 10) : ''}">`;
}
function fabValue(id, prec){
  const v = ($('#' + id)?.value || '').trim(); if(!v) return null;
  if(prec === 'anio') return /^\d{4}$/.test(v) ? v + '-01-01' : 'x';
  if(prec === 'mes') return /^\d{4}-\d{2}$/.test(v) ? v + '-01' : 'x';
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : 'x';
}
function vEppInvForm(D, p){
  const E = S.eppInvEd, it = D.catalogo.find(c => c.n === E.item), talles = it ? it.t : [];
  const items = D.catalogo.map(c => c.n); if(E.item && !items.includes(E.item)) items.unshift(E.item);
  return `<div class="card alert" style="margin-bottom:14px"><h3>${E.id ? 'Corregir equipo' : 'Agregar equipo'}</h3>
    <div class="row"><div class="field" style="flex:2 1 220px"><label class="label" for="iv_item">Equipo</label><select id="iv_item"><option value="">Elegir…</option>${items.map(n => `<option ${n === E.item ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="iv_talle">Talle</label><select id="iv_talle"><option value="">Sin dato</option>${[...new Set([...talles, ...(E.talle && !talles.includes(E.talle) ? [E.talle] : [])])].map(t => `<option ${t === E.talle ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field" style="flex:0 1 110px"><label class="label" for="iv_cant">Cantidad</label><input id="iv_cant" type="number" min="1" max="20" value="${E.cant || 1}"></div></div>
    <div class="row"><div class="field"><label class="label" for="iv_prec">Fecha de fabricación</label><select id="iv_prec">${PREC.map(([v, t]) => `<option value="${v}" ${v === E.prec ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="iv_fab">&nbsp;</label>${fabInput('iv_fab', E.prec, E.fab)}</div>
      <div class="field"><label class="label" for="iv_vida">Vida útil (años)</label><input id="iv_vida" type="number" min="1" max="50" value="${E.vida ?? ''}" placeholder="${it && it.v ? it.v + ' (catálogo)' : 'No vence'}"></div></div>
    <div class="row"><div class="field"><label class="label" for="iv_ent">Fecha de entrega (opcional)</label><input id="iv_ent" type="date" value="${E.ent || ''}"></div>
      <div class="field" style="flex:2 1 220px"><label class="label" for="iv_nota">Nota</label><input id="iv_nota" value="${esc(E.nota || '')}" placeholder="Ej.: marca, N° de serie"></div></div>
    <p class="demo" style="margin:8px 0 0">La fecha de fabricación está en la etiqueta de la prenda o del casco. La vida útil vacía usa la del catálogo.</p>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="ivsave">Guardar</button><button class="btn" id="ivcancel">Cancelar</button></div></div>`;
}
function eppInvCollect(){
  const E = S.eppInvEd;
  if(E){ const g = id => $('#' + id); const oldPrec = E.prec;
    if(g('iv_item')) E.item = g('iv_item').value; if(g('iv_talle')) E.talle = g('iv_talle').value; if(g('iv_cant')) E.cant = g('iv_cant').value;
    const f = fabValue('iv_fab', oldPrec); if(f && f !== 'x') E.fab = f;
    if(g('iv_prec')) E.prec = g('iv_prec').value; if(g('iv_vida')) E.vida = g('iv_vida').value; if(g('iv_ent')) E.ent = g('iv_ent').value; if(g('iv_nota')) E.nota = g('iv_nota').value; }
  const N = S.eppEntF;
  if(N){ const f = fabValue('en_fab', N.prec); if(f && f !== 'x') N.fab = f; const p = $('#en_prec'); if(p) N.prec = p.value; const v = $('#en_vida'); if(v) N.vida = v.value; const n = $('#en_nota'); if(n) N.nota = n.value; }
}
function vEppEntregaForm(x, D){
  const N = S.eppEntF || (S.eppEntF = { prec: 'mes', fab: '', vida: '', nota: '' }), it = D.catalogo.find(c => c.n === x.item);
  return `<div class="card alert" style="margin-top:10px;padding:12px"><b>Registrar entrega</b>
    <div class="row"><div class="field"><label class="label" for="en_prec">Fecha de fabricación</label><select id="en_prec">${PREC.map(([v, t]) => `<option value="${v}" ${v === N.prec ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="en_fab">&nbsp;</label>${fabInput('en_fab', N.prec, N.fab)}</div>
      <div class="field"><label class="label" for="en_vida">Vida útil (años)</label><input id="en_vida" type="number" min="1" max="50" value="${esc(N.vida)}" placeholder="${it && it.v ? it.v + ' (catálogo)' : 'No vence'}"></div></div>
    <div class="field"><label class="label" for="en_nota">Nota (opcional)</label><input id="en_nota" value="${esc(N.nota)}" placeholder="Ej.: entregado en depósito"></div>
    <p class="demo" style="margin:8px 0 0">Queda en el equipamiento de ${esc(nice(x.n))}. Si ya tenía el mismo equipo, el anterior pasa a "de baja".</p>
    <div class="row" style="margin-top:8px"><button class="btn primary" data-eppentok="${x.id}">Confirmar entrega</button><button class="btn" id="eppentno">Volver</button></div></div>`;
}
async function eppInvAction(t){
  const d = t.dataset, D = S.epp || {};
  if(d.eppent){ S.eppEnt = +d.eppent; S.eppEntF = null; render(); return true; }
  if(t.id === 'eppentno'){ S.eppEnt = null; S.eppEntF = null; render(); return true; }
  if(d.eppentok){ eppInvCollect(); const N = S.eppEntF, fab = fabValue('en_fab', N.prec);
    if(fab === 'x'){ toast('Revisá la fecha de fabricación.'); return true; }
    if(fab && fab > dstr(new Date())){ toast('La fecha de fabricación no puede ser futura.'); return true; }
    if(await act('epp_entregar', { sid: +d.eppentok, fabricacion: fab, prec: N.prec, vida: N.vida ? +N.vida : null, nota: N.nota || null }, 'Entrega registrada y cargada en su equipamiento.')){ S.eppEnt = null; S.eppEntF = null; render(); }
    return true; }
  if(d.ivper){ S.eppPer = +d.ivper; S.eppInvEd = null; S.eppBaja = null; render(); window.scrollTo(0, 0); return true; }
  if(t.id === 'ivback'){ S.eppPer = null; S.eppInvEd = null; render(); return true; }
  if(t.id === 'ivadd'){ S.eppInvEd = { id: null, item: '', talle: '', cant: 1, prec: 'mes', fab: '', vida: '', ent: '', nota: '' }; render(); return true; }
  if(d.ived){ const x = (D.invTodos || []).find(y => y.id === +d.ived); if(!x) return true;
    S.eppInvEd = { id: x.id, item: x.item, talle: x.talle || '', cant: x.cant, prec: x.prec, fab: x.fab || '', vida: x.vidaPropia ? x.vida : '', ent: x.ent || '', nota: x.nota || '' }; render(); window.scrollTo(0, 0); return true; }
  if(t.id === 'ivcancel'){ S.eppInvEd = null; render(); return true; }
  if(t.id === 'ivsave'){ const E = S.eppInvEd, fab = fabValue('iv_fab', $('#iv_prec').value); eppInvCollect();
    if(!E.item){ toast('Elegí el equipo.'); return true; }
    if(fab === 'x'){ toast('Revisá la fecha de fabricación.'); return true; }
    if(fab && fab > dstr(new Date())){ toast('La fecha de fabricación no puede ser futura.'); return true; }
    if(E.vida && !(+E.vida >= 1 && +E.vida <= 50)){ toast('La vida útil va de 1 a 50 años.'); return true; }
    if(await act('epp_inv_guardar', { iid: E.id, persona: S.eppPer, item: E.item, talle: E.talle || null, cantidad: +E.cant || 1, fabricacion: fab, prec: E.prec,
      vida: E.vida ? +E.vida : null, entregado: E.ent || null, nota: E.nota || null }, E.id ? 'Equipo corregido.' : 'Equipo agregado.')){ S.eppInvEd = null; render(); }
    return true; }
  if(d.ivbaja){ S.eppBaja = +d.ivbaja; render(); return true; }
  if(t.id === 'ivbajano'){ S.eppBaja = null; render(); return true; }
  if(d.ivbajaok){ const m = $('#ib_mot').value.trim(); if(m.length < 3){ toast('Indicá el motivo de la baja.'); return true; }
    if(await act('epp_inv_baja', { iid: +d.ivbajaok, motivo: m }, 'Equipo dado de baja. Queda en el historial.')){ S.eppBaja = null; render(); } return true; }
  if(t.id === 'invxls'){
    if(typeof XLSX === 'undefined'){ toast('No se pudo cargar el generador de Excel. Revisá la conexión.'); return true; }
    const ppl = new Set(invRows(D).map(r => r.id));
    const data = (D.invTodos || []).filter(x => x.estado === 'en_uso' && ppl.has(x.pid)).map(x => ({ Bombero: x.n, Ubicación: x.cargo || (x.g ? 'Guardia ' + x.g : 'Sin guardia'), Equipo: x.item,
      Talle: x.talle || 's/d', Cantidad: x.cant, Fabricación: fabTxt(x), 'Vida útil (años)': x.vida || '', Vence: venceTxt(x), Estado: eppSem(x).t, Entregado: x.ent ? fechaCorta(x.ent) : '', Nota: x.nota || '' }));
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Bombero: 'Sin datos' }]);
    ws['!cols'] = [26, 14, 24, 10, 9, 12, 10, 10, 18, 12, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Equipamiento'); XLSX.writeFile(wb, `EPP_equipamiento_${dstr(new Date())}.xlsx`);
    toast('Excel descargado.'); return true;
  }
  return false;
}
