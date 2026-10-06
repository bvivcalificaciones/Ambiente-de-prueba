/* =====================================================================
   ALERTAS
    · Alerta amarilla: la emiten jefatura o superiores (tipo, lugar, convocatoria, cobertura, cuartel, instituciones).
    · Apresto: cualquier bombero se anota como disponible, con una nota opcional.
    · Alerta roja: solo jefatura. Elige de los aprestos quién va y agrega los datos de salida.
    · Tonos: la jefatura elige uno para la amarilla y otro para la roja (para todos); cada dispositivo puede cambiarlo.
      Suenan con la app abierta. Con el celular bloqueado suena el aviso del teléfono, con vibración larga.
   ===================================================================== */
const TONOS = { sirena: 'Sirena ondulante', yelp: 'Sirena rápida (yelp)', bocina: 'Bocina de aire', alarma: 'Alarma de dos tonos', pitido: 'Pitidos de radio', timbre: 'Timbre' };
const COBERTURAS = [12, 24, 48, 72];

/* ---------- sonido (sintetizado: no usa archivos ni internet) ---------- */
let AC = null, toneNodes = [];
function audioCtx(){
  if(!AC){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; AC = new C(); }
  if(AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
// Los navegadores habilitan el sonido recién después del primer toque o tecla.
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => audioCtx(), { passive: true }));

function stopTone(){
  for(const n of toneNodes){ try { n.stop ? n.stop() : null; } catch(e){} try { n.disconnect(); } catch(e){} }
  toneNodes = [];
}
function playTone(name, secs = 8){
  stopTone();
  const ctx = audioCtx(); if(!ctx) return false;
  const t0 = ctx.currentTime + 0.05, end = t0 + secs;
  const master = ctx.createGain(); master.gain.value = 0.85;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const gate = ctx.createGain(); gate.gain.setValueAtTime(0, ctx.currentTime);
  gate.connect(lp); lp.connect(master); master.connect(ctx.destination);
  toneNodes.push(gate, lp, master);
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.connect(gate); o.start(t0); o.stop(end + 0.1); toneNodes.push(o); return o; };
  const on = (t, v = 1) => { gate.gain.setValueAtTime(0, t); gate.gain.linearRampToValueAtTime(v, t + 0.015); };
  const off = t => { gate.gain.setValueAtTime(gate.gain.value, t); gate.gain.linearRampToValueAtTime(0, t + 0.02); };
  if(name === 'sirena' || name === 'yelp'){
    const per = name === 'sirena' ? 3 : 0.36, o = osc('sawtooth', 650);
    on(t0, 0.7);
    for(let t = t0; t < end; t += per){ o.frequency.setValueAtTime(650, t); o.frequency.linearRampToValueAtTime(1450, t + per/2); o.frequency.linearRampToValueAtTime(650, t + per); }
    off(end - 0.05);
  } else if(name === 'alarma'){
    const o = osc('square', 960); on(t0, 0.45);
    let hi = true; for(let t = t0; t < end; t += 0.5){ o.frequency.setValueAtTime(hi ? 960 : 770, t); hi = !hi; }
    off(end - 0.05);
  } else if(name === 'bocina'){
    osc('sawtooth', 311); osc('sawtooth', 370); osc('square', 233);
    for(let t = t0; t < end; t += 1){ on(t, 0.5); off(t + 0.7); }
  } else if(name === 'pitido'){
    osc('sine', 1050);
    for(let t = t0; t < end; t += 1.4){ for(let i = 0; i < 4; i++){ on(t + i*0.2, 0.9); off(t + i*0.2 + 0.12); } }
  } else { // timbre
    const o = osc('sine', 880);
    for(let t = t0; t < end; t += 1.6){
      o.frequency.setValueAtTime(880, t); gate.gain.setValueAtTime(1, t); gate.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
      o.frequency.setValueAtTime(660, t + 0.75); gate.gain.setValueAtTime(1, t + 0.75); gate.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
    }
  }
  return ctx.state === 'running';
}
const toneDe = color => LS.get('bviv_tono_' + color) || (S.tonos || {})[color] || (color === 'roja' ? 'sirena' : 'bocina');

/* ---------- aviso en pantalla y repique hasta que alguien lo vea ---------- */
const RING = { color: null, timer: null, ciclos: 0 };
const vistas = () => { try { return JSON.parse(LS.get('bviv_alr_vistas') || '{}'); } catch(e){ return {}; } };
function marcarVistas(){ const v = vistas(); for(const a of S.alertas || []) v[a.id] = a.color; LS.set('bviv_alr_vistas', JSON.stringify(v)); }
function ringStop(){ clearInterval(RING.timer); RING.timer = null; RING.color = null; stopTone(); }
function ringStart(color){
  if(RING.color === color) return;
  ringStop(); RING.color = color; RING.ciclos = 0;
  const ciclo = () => {
    if(RING.ciclos++ >= 10){ marcarVistas(); ringStop(); renderAlertBar(); return; }   // unos 4 minutos como máximo
    playTone(toneDe(color), 10);
    try { navigator.vibrate && navigator.vibrate(color === 'roja' ? [1000, 300, 1000, 300, 1000] : [500, 200, 500, 200, 500]); } catch(e){}
  };
  ciclo(); RING.timer = setInterval(ciclo, 25000);
}
function alertCheck(){
  const act = S.alertas || [], v = vistas();
  const nuevas = act.filter(a => v[a.id] !== a.color);
  if(nuevas.length) ringStart(nuevas.some(a => a.color === 'roja') ? 'roja' : 'amarilla');
  else if(RING.color) ringStop();
  const sig = act.map(a => a.id + a.color + a.n).join('|');
  if(sig !== alertCheck.sig){
    const antes = alertCheck.sig; alertCheck.sig = sig;
    renderAlertBar();
    if(S.saver) renderSaver();
    if(antes !== undefined && S.tab === 'alertas' && isLogged() && !S.busy && !document.querySelector('input:focus,select:focus,textarea:focus')) reload();
  }
}
function alertLine(a){ return [a.lugar, a.fecha ? 'convocatoria ' + fmtD(a.fecha) + ' h' : '', `${a.n} en apresto`].filter(Boolean).join(' · '); }
function renderAlertBar(){
  const el = document.getElementById('alertbar'); if(!el) return;
  const act = S.alertas || [];
  el.innerHTML = act.length && S.tab !== 'alertas' ? act.map(a => `<div class="alrbar ${a.color}"><span class="alr-ic" aria-hidden="true">!</span>
    <div class="alr-tx"><b>Alerta ${a.color} · ${esc(a.tipo)}</b><span>${esc(alertLine(a))}</span></div>
    <div class="alr-btns">${RING.color ? '<button class="btn small" id="alrmute">Silenciar</button>' : ''}<button class="btn small outline" id="goalert">${a.color === 'roja' ? 'Ver designados' : 'Ponerme en apresto'}</button></div></div>`).join('')
    : (act.length && RING.color ? `<div class="alrbar ${RING.color}"><span class="alr-ic" aria-hidden="true">!</span><div class="alr-tx"><b>Alerta nueva</b><span>Revisá abajo.</span></div><div class="alr-btns"><button class="btn small" id="alrmute">Silenciar</button></div></div>` : '');
}
function saverAlerts(){
  const act = S.alertas || []; if(!act.length) return '';
  return act.map(a => `<div class="sv-alert ${a.color}"><b>ALERTA ${a.color.toUpperCase()} · ${esc(a.tipo)}</b><span>${esc(alertLine(a))}</span></div>`).join('');
}
function goAlertas(){
  const cur = sess(), pasa = S.tab === 'guardia' && cur.step === 'me' && cur.tok ? { who: cur.who, tok: cur.tok } : null;
  if(!pasa && isLogged()) logoutSess();
  S.tab = 'alertas'; S.mode = null;
  if(pasa){ Object.assign(S.sess.alertas, { step: 'me', who: pasa.who, tok: pasa.tok, pin: '' }); Object.assign(S.sess.guardia, { step: 'pin', tok: null, pin: '' }); reload(); }
  else { prefillYo(); render(); }
  window.scrollTo(0, 0);
}
async function alertGlobal(t){
  if(t.id === 'alrmute'){ marcarVistas(); ringStop(); renderAlertBar(); if(S.tab === 'alertas') render(); return true; }
  if(t.id === 'goalert'){ marcarVistas(); ringStop(); goAlertas(); return true; }
  return false;
}

/* ---------- pantalla ---------- */
const alrDet = rows => `<dl class="alrdl">${rows.filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
function alrPubCard(a){
  return `<div class="alrcard ${a.color}"><div class="top"><span class="pill ${a.color === 'roja' ? 'red' : 'yellow'}">Alerta ${a.color}</span><span class="meta">${a.n} en apresto</span></div>
    <h3>${esc(a.tipo)}</h3><p style="margin:0">${esc(alertLine(a))}</p></div>`;
}
function vAlertas(){
  const s = sess(), v = s.step === 'me' ? s.who : null;
  if(!v){
    if(s.step === 'pin') return vPin('Ingresá tu PIN', nice(s.who)) + (S.tab === 'alertas' && !isKiosk() ? '<p style="text-align:center"><button class="linkbtn" id="notyo">No soy yo</button></p>' : '');
    if(s.step === 'newpin') return vNewPin();
    const pub = (S.alertas || []).map(alrPubCard).join('');
    return vWho('Alertas', 'Ingresá con tu PIN para ponerte en apresto. Jefatura y superiores emiten las alertas.', active(),
      pub ? `<div class="alrgrid" style="margin-bottom:18px">${pub}</div>` : '<p class="card off" style="margin:0 0 18px">No hay alertas activas.</p>') + vTonoDispositivo(false);
  }
  const D = S.alr || { alertas: [], puede: false, roja: false };
  const act = D.alertas.filter(a => a.estado === 'activa'), past = D.alertas.filter(a => a.estado !== 'activa');
  const head = `<div class="who"><div><span class="label">${esc(nice(v))} · Convocatorias y aprestos</span><h2>Alertas</h2></div><span class="row" style="gap:6px"><button class="btn outline small" id="alrreload">Actualizar</button><button class="btn outline small" id="bye">Salir</button></span></div>`;
  return head + (D.puede ? vAlrNueva() : '')
    + `<div class="alrlist">${act.map(a => vAlrCard(a, D, v)).join('') || '<p class="card off" style="margin:0">No hay alertas activas.</p>'}</div>`
    + (past.length ? `<div class="section-h"><h3 style="margin:0">Anteriores</h3><button class="btn small outline" id="alrpast">${S.alrPast ? 'Ocultar' : 'Ver las ' + past.length}</button></div>${S.alrPast ? `<div class="alrlist">${past.map(a => vAlrCard(a, D, v)).join('')}</div>` : ''}` : '')
    + (D.roja ? vAlrConfig() : '') + vTonoDispositivo(true);
}
function vAlrNueva(){
  if(!S.alrNew) return '<button class="btn primary big" id="alrnew" style="margin:0 0 16px;background:#b88a00;color:#111">Emitir alerta amarilla</button>';
  const now = new Date(); now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return `<div class="card alrform" style="margin-bottom:16px"><h3>Nueva alerta amarilla</h3>
    <div class="row"><div class="field"><label class="label" for="al_tipo">Tipo</label><select id="al_tipo">${(S.alertaTipos || []).map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
      <div class="field" style="flex:2 1 220px"><label class="label" for="al_lugar">Lugar</label><input id="al_lugar" placeholder="Ej.: Campo Los Álamos, ruta 8 km 290"></div></div>
    <div class="row"><div class="field"><label class="label" for="al_fecha">Fecha de convocatoria</label><input id="al_fecha" type="date" value="${dstr(now)}"></div>
      <div class="field"><label class="label" for="al_hora_h">Hora</label>${horaSel('al_hora', iso(now).slice(11, 16))}</div>
      <div class="field"><label class="label" for="al_cob">Tiempo de cobertura</label><select id="al_cob"><option value="">Sin definir</option>${COBERTURAS.map(h => `<option value="${h}">${h} horas</option>`).join('')}<option value="otro">Otra…</option></select></div>
      <div class="field" id="al_cobotro_f" hidden><label class="label" for="al_cobotro">Horas de cobertura</label><input id="al_cobotro" type="number" min="1" max="720" inputmode="numeric" placeholder="Ej.: 96"></div>
      <div class="field"><label class="label" for="al_cuartel">Cuartel a cubrir (opcional)</label><input id="al_cuartel" placeholder="N°" inputmode="numeric"></div></div>
    <div class="field"><label class="label" for="al_inst">Instituciones alcanzadas</label><input id="al_inst" placeholder="Ej.: Federación, Defensa Civil, cuarteles de la regional"></div>
    <div class="field"><label class="label" for="al_obs">Indicaciones (opcional)</label><textarea id="al_obs" rows="2" placeholder="Ej.: llevar ropa para 24 h, agua y linterna"></textarea></div>
    <p class="demo" style="margin:10px 0 0">Se avisa a todos los celulares con avisos activados, con el tono de alerta amarilla.</p>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="alrcreate">Emitir y avisar a todos</button><button class="btn" id="alrnew">Cancelar</button></div></div>`;
}
function vAlrCard(a, D, v){
  const roja = a.color === 'roja', activa = a.estado === 'activa', R = a.roja || {};
  const me = a.aprestos.find(x => x.n === v), sel = a.aprestos.filter(x => x.sel);
  const estado = activa ? `<span class="pill ${roja ? 'red' : 'yellow'}">Alerta ${a.color}</span>` : `<span class="pill">${a.estado === 'finalizada' ? 'Finalizada' : 'Cancelada'}</span>`;
  let mine = '';
  if(activa){
    if(roja && me && me.sel) mine = `<div class="alrme sel"><b>Fuiste designado</b><span>${esc([R.encuentro && 'Encuentro: ' + R.encuentro, R.salida && 'Salida: ' + R.salida].filter(Boolean).join(' · ') || 'Seguí las indicaciones de la jefatura.')}</span></div>`;
    else if(roja && me) mine = `<div class="alrme"><b>Estás en apresto</b><span>Esta vez no fuiste designado. Seguí atento por si se amplía.</span></div>`;
    else if(roja) mine = `<div class="alrme"><b>La alerta ya está en rojo</b><span>El apresto está cerrado.</span></div>`;
    else if(me) mine = `<div class="alrme ok"><b>Estás en apresto</b><span>${me.nota ? esc(me.nota) : 'Sin nota'}</span><button class="btn small" id="alrout-${a.id}" data-alrout="${a.id}">Salir del apresto</button></div>`;
    else mine = `<div class="alrme"><div class="field" style="margin:0"><label class="label" for="al_nota${a.id}">Nota (opcional)</label><input id="al_nota${a.id}" placeholder="Ej.: llego en 20 min, tengo camioneta"></div>
      <button class="btn go big" style="margin-top:10px" data-alrap="${a.id}">Me pongo en apresto</button></div>`;
  }
  const lista = a.aprestos.length ? `<ul class="list alrap">${[...sel, ...a.aprestos.filter(x => !x.sel)].map(x => `<li><span>${insigniaDe(x.n, 14)} <b>${esc(x.n)}</b>${x.sel ? ' <span class="tag red">Designado</span>' : ''}<br><span class="meta">${x.cargo ? esc(x.cargo) : x.g ? 'Guardia ' + x.g : 'Sin guardia'}${x.nota ? ' · ' + esc(x.nota) : ''}</span></span><span class="meta mono">${fmtD(loc(x.ts)).slice(6)}</span></li>`).join('')}</ul>` : '<p class="empty" style="padding:4px 0">Nadie en apresto todavía.</p>';
  let jef = '';
  if(activa && D.roja){
    if(S.alrRoja === a.id){
      const pre = new Set(sel.map(x => x.id));
      jef = `<div class="alrroja"><h3>${roja ? 'Cambiar designados' : 'Pasar a ALERTA ROJA'}</h3>
        <span class="label">Quiénes van (de los que están en apresto)</span>
        <div class="alrsel">${a.aprestos.map(x => `<label class="check"><input type="checkbox" data-alrsel="${x.id}" ${pre.has(x.id) ? 'checked' : ''}> ${esc(x.n)}${x.nota ? ` <span class="meta">· ${esc(x.nota)}</span>` : ''}</label>`).join('') || '<p class="meta">Nadie en apresto.</p>'}</div>
        <div class="row"><div class="field"><label class="label" for="ar_enc">Lugar de encuentro</label><input id="ar_enc" value="${esc(R.encuentro || '')}" placeholder="Ej.: Cuartel"></div>
          <div class="field"><label class="label" for="ar_sal">Hora de salida</label><input id="ar_sal" value="${esc(R.salida || '')}" placeholder="Ej.: 18:30"></div>
          <div class="field"><label class="label" for="ar_uni">Unidades</label><input id="ar_uni" value="${esc(R.unidades || '')}" placeholder="Ej.: Unidad 14 y 9"></div></div>
        <div class="row"><div class="field"><label class="label" for="ar_cargo">A cargo</label><input id="ar_cargo" value="${esc(R.acargo || '')}" placeholder="Ej.: Sgto. B.V. Alchapar Diego"></div>
          <div class="field" style="flex:2 1 220px"><label class="label" for="ar_obs">Indicaciones</label><input id="ar_obs" value="${esc(R.obs || '')}" placeholder="Ej.: llevar EPP forestal y ropa para 24 h"></div></div>
        <p class="demo" style="margin:10px 0 0">Los designados reciben el aviso con el tono de alerta roja. A los demás aprestos se les avisa que esta vez no van.</p>
        <div class="row" style="margin-top:10px"><button class="btn primary" data-alrrojago="${a.id}">${roja ? 'Guardar y avisar a los nuevos' : 'Confirmar ALERTA ROJA'}</button><button class="btn" id="alrrojano">Cancelar</button></div></div>`;
    } else jef = `<button class="btn ${roja ? 'outline' : 'primary'}" data-alrroja="${a.id}" ${a.aprestos.length ? '' : 'disabled title="Nadie en apresto"'}>${roja ? 'Cambiar designados' : 'Pasar a alerta roja'}</button>`;
  }
  const cierre = activa && D.puede ? `<button class="btn outline" id="alrfin-${a.id}">Finalizar</button><button class="btn" id="alrcan-${a.id}">Cancelar alerta</button>` : '';
  return `<article class="alrcard ${activa ? a.color : 'cerrada'}"><div class="top">${estado}<span class="meta">Emitida ${fmtD(loc(a.creado))} por ${esc(nice(a.por || ''))}</span></div>
    <h3>${esc(a.tipo)} · ${esc(a.lugar || '')}</h3>
    <div class="grid2 alrcols"><div>
      ${alrDet([['Convocatoria', a.fecha ? fmtD(loc(a.fecha)) + ' h' : ''], ['Cobertura', a.cobertura ? a.cobertura + ' horas' : 'Sin definir'], ['Cuartel a cubrir', a.cuartel ? 'N° ' + a.cuartel : ''], ['Instituciones', a.inst], ['Indicaciones', a.obs]])}
      ${roja ? `<div class="alrrojadet"><span class="label">Alerta roja · ${a.rojaEn ? fmtD(loc(a.rojaEn)) : ''}${a.rojaPor ? ' · ' + esc(nice(a.rojaPor)) : ''}</span>${alrDet([['Encuentro', R.encuentro], ['Salida', R.salida], ['Unidades', R.unidades], ['A cargo', R.acargo], ['Indicaciones', R.obs]])}</div>` : ''}
      ${mine}
    </div><div><span class="label">En apresto · ${a.aprestos.length}${sel.length ? ` · ${sel.length} designado${sel.length > 1 ? 's' : ''}` : ''}</span>${lista}</div></div>
    ${jef || cierre ? `<div class="row alrbtns">${jef}${cierre}</div>` : ''}</article>`;
}
function vAlrConfig(){
  const T = S.tonos || {};
  const tsel = (id, v) => `<select id="${id}">${Object.entries(TONOS).map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  return `<div class="section-h"><h3 style="margin:0">Configuración de alertas</h3><span class="demo">Administradores y jefatura</span></div>
  <div class="grid2"><div class="card"><h3>Tipos de alerta</h3><div class="field"><label class="label" for="ac_tipos">Uno por línea</label><textarea id="ac_tipos" rows="6">${esc((S.alertaTipos || []).join('\n'))}</textarea></div></div>
  <div class="card"><h3>Tonos para todos</h3>
    <div class="row"><div class="field"><label class="label" for="ac_am">Alerta amarilla</label>${tsel('ac_am', T.amarilla)}</div><div class="field" style="flex:0 0 auto;align-self:end"><button class="btn outline" data-tonesel="ac_am">Probar</button></div></div>
    <div class="row"><div class="field"><label class="label" for="ac_ro">Alerta roja</label>${tsel('ac_ro', T.roja)}</div><div class="field" style="flex:0 0 auto;align-self:end"><button class="btn outline" data-tonesel="ac_ro">Probar</button></div></div>
    <p class="demo" style="margin:10px 0 0">Elegí dos bien distintos. Es el tono que suena en todos los dispositivos con la app abierta, salvo que alguien elija otro en el suyo.</p></div></div>
  <div class="row" style="margin-top:12px"><button class="btn primary" id="alrcfgsave">Guardar configuración</button><button class="btn" id="tonestop">Detener sonido</button></div>`;
}
function vTonoDispositivo(logged){
  const T = S.tonos || {};
  const opt = (color) => { const cur = LS.get('bviv_tono_' + color) || '';
    return `<select id="td_${color}"><option value="">El del cuartel (${esc(TONOS[T[color]] || '')})</option>${Object.entries(TONOS).map(([k, n]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${n}</option>`).join('')}</select>`; };
  return `<details class="card alrtono" style="margin-top:18px"${logged ? '' : ' open'}><summary><b>Sonido de alertas en este dispositivo</b></summary>
    <div class="row"><div class="field"><label class="label" for="td_amarilla">Alerta amarilla</label>${opt('amarilla')}</div><div class="field" style="flex:0 0 auto;align-self:end"><button class="btn outline" data-tonetest="amarilla">Probar</button></div></div>
    <div class="row"><div class="field"><label class="label" for="td_roja">Alerta roja</label>${opt('roja')}</div><div class="field" style="flex:0 0 auto;align-self:end"><button class="btn outline" data-tonetest="roja">Probar</button></div></div>
    <button class="btn" style="margin-top:10px" id="tonestop">Detener sonido</button>
    <p class="demo" style="margin:12px 0 0"><b>Con la app abierta</b> (por ejemplo, la PC del cuartel) la alerta suena con este tono y se repite hasta que alguien toque <b>Silenciar</b>.<br>
    <b>Con el celular bloqueado</b> llega la notificación con vibración larga y queda fija en pantalla. El sonido es el de notificaciones del teléfono: en Android podés darle a esta app un sonido propio desde Ajustes → Aplicaciones → Bomberos IV → Notificaciones. Probá el volumen acá.</p></details>`;
}

/* ---------- acciones ---------- */
async function alertAction(t){
  const d = t.dataset;
  if(t.id === 'alrreload'){ await reload(); return true; }
  if(t.id === 'alrnew'){ S.alrNew = !S.alrNew; render(); return true; }
  if(t.id === 'alrpast'){ S.alrPast = !S.alrPast; render(); return true; }
  if(d.tonetest){ const name = $('#td_' + d.tonetest)?.value || (S.tonos || {})[d.tonetest]; if(!playTone(name, 5)) toast('Subí el volumen. Si no suena, tocá la pantalla y probá de nuevo.'); return true; }
  if(d.tonesel){ playTone($('#' + d.tonesel).value, 5); return true; }
  if(t.id === 'tonestop'){ stopTone(); return true; }
  if(t.id === 'alrcreate'){
    const lugar = $('#al_lugar').value.trim(), fecha = $('#al_fecha').value && horaVal('al_hora') ? $('#al_fecha').value + 'T' + horaVal('al_hora') : '';
    if(lugar.length < 2){ toast('Indicá el lugar.'); return true; }
    if(!fecha){ toast('Indicá la fecha y hora de convocatoria.'); return true; }
    if($('#al_cob').value === 'otro' && !(+$('#al_cobotro').value >= 1 && +$('#al_cobotro').value <= 720)){ toast('Indicá las horas de cobertura (de 1 a 720).'); return true; }
    const id = await act('alerta_crear', { tipo: $('#al_tipo').value, lugar, fecha, cobertura: $('#al_cob').value === 'otro' ? (+$('#al_cobotro').value || null) : $('#al_cob').value ? +$('#al_cob').value : null,
      cuartel: $('#al_cuartel').value, instituciones: $('#al_inst').value, obs: $('#al_obs').value }, 'Alerta amarilla emitida. Se avisó a todos.');
    if(id){ const v = vistas(); v[id] = 'amarilla'; LS.set('bviv_alr_vistas', JSON.stringify(v)); ringStop(); S.alrNew = false; render(); }
    return true;
  }
  if(d.alrap){ await act('alerta_apresto', { aid: +d.alrap, si: true, nota: $('#al_nota' + d.alrap)?.value || null }, 'Quedaste en apresto. Si te designan, te avisamos.'); return true; }
  if(d.alrout){ if(!confirmTwice(t, 'Tocá de nuevo para salir del apresto.')) return true;
    await act('alerta_apresto', { aid: +d.alrout, si: false, nota: null }, 'Saliste del apresto.'); return true; }
  if(d.alrroja){ S.alrRoja = +d.alrroja; render(); return true; }
  if(t.id === 'alrrojano'){ S.alrRoja = null; render(); return true; }
  if(d.alrrojago){
    const ids = [...document.querySelectorAll('[data-alrsel]:checked')].map(x => +x.dataset.alrsel);
    if(!ids.length){ toast('Marcá al menos un bombero.'); return true; }
    const datos = { encuentro: $('#ar_enc').value.trim(), salida: $('#ar_sal').value.trim(), unidades: $('#ar_uni').value.trim(), acargo: $('#ar_cargo').value.trim(), obs: $('#ar_obs').value.trim() };
    const n = await act('alerta_roja', { aid: +d.alrrojago, seleccionados: ids, datos }, x => `Alerta roja: se avisó a ${x} designado${x == 1 ? '' : 's'}.`);
    if(n !== null){ const v = vistas(); v[+d.alrrojago] = 'roja'; LS.set('bviv_alr_vistas', JSON.stringify(v)); ringStop(); S.alrRoja = null; render(); }
    return true;
  }
  const m = /^alr(fin|can)-(\d+)$/.exec(t.id || '');
  if(m){ const fin = m[1] === 'fin';
    if(!confirmTwice(t, `Tocá de nuevo para ${fin ? 'finalizar' : 'cancelar'} la alerta.`)) return true;
    await act('alerta_cerrar', { aid: +m[2], como: fin ? 'finalizada' : 'cancelada' }, fin ? 'Alerta finalizada.' : 'Alerta cancelada.'); return true; }
  if(t.id === 'alrcfgsave'){
    const tipos = $('#ac_tipos').value.split('\n').map(x => x.trim()).filter(Boolean);
    if(!tipos.length){ toast('Cargá al menos un tipo de alerta.'); return true; }
    if(new Set(tipos.map(x => x.toLowerCase())).size !== tipos.length){ toast('Hay tipos repetidos.'); return true; }
    const am = $('#ac_am').value, ro = $('#ac_ro').value;
    if(am === ro && !confirmTwice(t, 'Los dos tonos son iguales. Tocá de nuevo para guardar igual.')) return true;
    await act('guardar_alertas_cfg', { tipos, tonos: { amarilla: am, roja: ro } }, 'Configuración de alertas guardada.'); return true;
  }
  return false;
}
function alertChange(e){
  const id = e.target.id || '';
  if(id === 'al_cob'){ const f = document.getElementById('al_cobotro_f'); if(f) f.hidden = e.target.value !== 'otro'; return true; }
  if(id === 'td_amarilla' || id === 'td_roja'){ LS.set('bviv_tono_' + id.slice(3), e.target.value || null); toast('Tono guardado en este dispositivo.'); return true; }
  return false;
}
