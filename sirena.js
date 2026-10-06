/* =====================================================================
   SIRENA · solo en la PC del cuartel, para administradores, jefatura y superiores.
   Modos (se configuran en cada PC, los guarda el navegador):
    · Simulación: suena en los parlantes de la PC (para probar sin relé).
    · Relé USB serie (CH340, tipo LCUS-1): Chrome/Edge con Web Serial.
    · Relé USB HID (tipo "USBRelay", 16c0:05df): Chrome/Edge con WebHID.
   Cada activación queda registrada en la base (quién, cuándo, qué patrón).
   ===================================================================== */
const SIR_DEF = { modo: 'sim', sonido: true, toque: 4, pausa: 2, maxCont: 60, baud: 9600, on: 'A0 01 01 A2', off: 'A0 01 00 A1' };
const SIR = { run: null, paso: '', left: 0, abort: false, confirm: null, cfgOpen: false, port: null, hid: null };
function sirCfg(){ try { return { ...SIR_DEF, ...JSON.parse(LS.get('bviv_sirena') || '{}') }; } catch(e){ return { ...SIR_DEF }; } }
function sirenBusy(){ return !!SIR.run; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitAbort(ms){ const end = Date.now() + ms; while(!SIR.abort && Date.now() < end){ SIR.left = Math.ceil((end - Date.now())/1000); sirState(); await sleep(150); } }

/* ---------- sonido de prueba (sirena de bomberos simulada) ---------- */
const sirSound = {
  ctx: null, nodes: null,
  start(){
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const c = this.ctx; if(c.state === 'suspended') c.resume();
      this.stop();
      const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 850; g.gain.value = 0.12;
      l.type = 'sine'; l.frequency.value = 0.3; lg.gain.value = 380;
      l.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(c.destination);
      o.start(); l.start(); this.nodes = [o, l];
    } catch(e){}
  },
  stop(){ if(this.nodes){ this.nodes.forEach(n => { try { n.stop(); } catch(e){} }); this.nodes = null; } }
};

/* ---------- relé ---------- */
function hexBytes(s){
  const a = String(s || '').trim().split(/[\s,]+/).filter(Boolean).map(x => parseInt(x.replace(/^0x/i, ''), 16));
  if(!a.length || a.some(v => isNaN(v) || v < 0 || v > 255)) throw new Error('El comando del relé no es válido (bytes en hexadecimal, ej.: A0 01 01 A2).');
  return new Uint8Array(a);
}
const relay = {
  async connect(interactive){
    const c = sirCfg();
    if(c.modo === 'serial'){
      if(!('serial' in navigator)) throw new Error('Este navegador no admite relés USB serie. Usá Chrome o Edge.');
      if(!SIR.port){ const ps = await navigator.serial.getPorts(); SIR.port = ps[0] || (interactive ? await navigator.serial.requestPort() : null); }
      if(!SIR.port) throw new Error('No hay relé conectado. Un administrador tiene que conectarlo en "Configurar relé".');
      if(!SIR.port.writable) await SIR.port.open({ baudRate: +c.baud || 9600 });
    } else if(c.modo === 'hid'){
      if(!('hid' in navigator)) throw new Error('Este navegador no admite relés USB HID. Usá Chrome o Edge.');
      if(!SIR.hid){ const ds = await navigator.hid.getDevices();
        SIR.hid = ds[0] || (interactive ? (await navigator.hid.requestDevice({ filters: [{ vendorId: 0x16c0, productId: 0x05df }] }))[0] : null); }
      if(!SIR.hid) throw new Error('No hay relé conectado. Un administrador tiene que conectarlo en "Configurar relé".');
      if(!SIR.hid.opened) await SIR.hid.open();
    }
  },
  async set(on){
    const c = sirCfg();
    if(c.modo === 'serial'){
      await relay.connect(false);
      const w = SIR.port.writable.getWriter();
      try { await w.write(hexBytes(on ? c.on : c.off)); } finally { w.releaseLock(); }
    } else if(c.modo === 'hid'){
      await relay.connect(false);
      const r = new Uint8Array(8); r[0] = on ? 0xFF : 0xFD; r[1] = 1;
      await SIR.hid.sendFeatureReport(0, r);
    }
    if(c.modo === 'sim' || c.sonido) on ? sirSound.start() : sirSound.stop();
  }
};

/* ---------- ejecución ---------- */
const PATRON_TXT = { '1': '1 toque', '2': '2 toques', '3': '3 toques', '4': '4 toques', continua: 'Continua', prueba: 'Prueba' };
function sirLog(patron){
  rpc('registrar_sirena', { tok: S.sess.kiosco.tok, kiosco: KIOSK_KEY(), patron })
    .catch(() => toast('Sin conexión: la activación no quedó registrada, pero la sirena funciona igual.'));
}
async function sirenRun(patron){
  if(SIR.run) return;
  const c = sirCfg(), n = patron === 'continua' ? 0 : +patron;
  SIR.abort = false; SIR.run = patron; SIR.confirm = null; render();
  try {
    await relay.connect(false);
    sirLog(patron);
    if(n === 0){
      SIR.paso = 'Sonando en continuo'; await relay.set(true); await waitAbort(c.maxCont*1000);
    } else {
      for(let i = 1; i <= n && !SIR.abort; i++){
        SIR.paso = `Toque ${i} de ${n}`; await relay.set(true); await waitAbort(c.toque*1000);
        await relay.set(false);
        if(i < n && !SIR.abort){ SIR.paso = `Pausa · sigue el toque ${i + 1}`; await waitAbort(c.pausa*1000); }
      }
    }
  } catch(e){ toast('Sirena: ' + e.message); }
  finally {
    try { await relay.set(false); } catch(e){}
    sirSound.stop(); SIR.run = null; SIR.paso = ''; resetIdle(); render();
  }
}
async function sirenStop(){
  if(!SIR.run) return;
  SIR.abort = true; sirSound.stop();
  try { await relay.set(false); } catch(e){}
  sirLog('detener');
}

/* ---------- pantalla ---------- */
const SIR_ICON = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 45V33a15 15 0 0 1 30 0v12z" fill="#fff"/><path d="M24 33a8 8 0 0 1 8-8" stroke="#c8102e" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="11" y="45" width="42" height="8" rx="2" fill="#fff"/><path d="M32 5v8M11 13l6 6M53 13l-6 6M3 32h8M53 32h8" stroke="#ffc72c" stroke-width="4" stroke-linecap="round"/></svg>`;
const sirButton = () => isKiosk() ? `<button class="sirbtn" id="opensiren" aria-label="Sirena">${SIR_ICON}<span>SIRENA</span></button>` : '';
function sirState(){
  const el = document.getElementById('sirstate'); if(!el) return;
  el.className = 'sirstate' + (SIR.run ? ' on' : '');
  el.innerHTML = SIR.run
    ? `<b>SIRENA ACTIVA · ${esc(PATRON_TXT[SIR.run])}</b><span>${esc(SIR.paso)}${SIR.left ? ` · ${SIR.left} s` : ''}</span>`
    : `<b>Sirena en reposo</b><span>Elegí el patrón y confirmá.</span>`;
}
function vSirena(viewer){
  const c = sirCfg(), adm = roleOf(viewer) === 'admin', run = !!SIR.run;
  const modo = { sim: 'Simulación (suena en los parlantes de la PC)', serial: 'Relé USB serie', hid: 'Relé USB HID' }[c.modo];
  const cfg = adm && SIR.cfgOpen ? `<div class="card" style="margin-top:16px"><h3>Configurar relé de esta PC</h3>
    <div class="row">
      <div class="field"><label class="label" for="sc_modo">Modo</label><select id="sc_modo">${[['sim','Simulación (sin relé)'],['serial','Relé USB serie (CH340 / LCUS)'],['hid','Relé USB HID (USBRelay)']].map(([v,t]) => `<option value="${v}" ${c.modo===v?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="sc_toque">Duración del toque (s)</label><input id="sc_toque" type="number" min="1" max="30" value="${c.toque}"></div>
      <div class="field"><label class="label" for="sc_pausa">Pausa entre toques (s)</label><input id="sc_pausa" type="number" min="1" max="30" value="${c.pausa}"></div>
      <div class="field"><label class="label" for="sc_max">Continua: corte automático (s)</label><input id="sc_max" type="number" min="5" max="600" value="${c.maxCont}"></div>
    </div>
    <div class="row">
      <div class="field"><label class="label" for="sc_baud">Velocidad serie (baudios)</label><input id="sc_baud" type="number" value="${c.baud}"></div>
      <div class="field"><label class="label" for="sc_on">Comando encender (hex)</label><input id="sc_on" class="mono" value="${esc(c.on)}"></div>
      <div class="field"><label class="label" for="sc_off">Comando apagar (hex)</label><input id="sc_off" class="mono" value="${esc(c.off)}"></div>
    </div>
    <label class="check"><input type="checkbox" id="sc_son" ${c.sonido?'checked':''}> También sonar en los parlantes de la PC</label>
    <p class="demo" style="margin:8px 0 0">Relés más comunes: <b>USB serie LCUS-1 (CH340)</b> a 9600 baudios, encender <span class="mono">A0 01 01 A2</span> y apagar <span class="mono">A0 01 00 A1</span>. <b>USB HID "USBRelay"</b> no necesita comandos. El relé acciona el contactor de la sirena; la instalación eléctrica la tiene que hacer un electricista.</p>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="sc_save">Guardar</button><button class="btn outline" id="sc_conn">Conectar relé</button><button class="btn outline" id="sc_test">Probar 1 segundo</button></div></div>` : '';
  return `<div class="who"><div><span class="label">${esc(nice(viewer))} · ${roleLabel(viewer)}</span><h2>Sirena</h2></div><button class="btn outline" id="bye">Salir</button></div>
  <div class="sirpanel">
    <div id="sirstate" class="sirstate"></div>
    <div class="sirgrid">${['1','2','3','4'].map(k => `<button class="sirp ${SIR.confirm===k?'sel':''}" data-sir="${k}" ${run?'disabled':''}><b>${k}</b><span>${k==='1'?'toque':'toques'}</span></button>`).join('')}
      <button class="sirp wide ${SIR.confirm==='continua'?'sel':''}" data-sir="continua" ${run?'disabled':''}><b>CONTINUA</b><span>hasta ${c.maxCont} s o hasta detener</span></button></div>
    ${SIR.confirm && !run ? `<div class="sirconfirm"><button class="btn big sirgo" id="sirgo">ACTIVAR · ${esc(PATRON_TXT[SIR.confirm]).toUpperCase()}</button><button class="btn outline" id="sircancel">Cancelar</button></div>` : ''}
    <button class="sirstop" id="sirstop" ${run?'':'disabled'}>DETENER</button>
    <p class="demo" style="margin:10px 0 0">Modo: <b>${modo}</b> · toque ${c.toque} s, pausa ${c.pausa} s. Cada activación queda registrada con tu nombre.</p>
    ${adm ? `<p style="margin:8px 0 0"><button class="linkbtn" id="sircfg">${SIR.cfgOpen ? 'Cerrar configuración' : 'Configurar relé de esta PC'}</button></p>` : ''}
  </div>${cfg}`;
}

/* ---------- acciones ---------- */
async function sirenAction(t){
  const d = t.dataset;
  if(d.sir){ SIR.confirm = SIR.confirm === d.sir ? null : d.sir; render(); return true; }
  if(t.id === 'sircancel'){ SIR.confirm = null; render(); return true; }
  if(t.id === 'sirgo'){ sirenRun(SIR.confirm); return true; }
  if(t.id === 'sirstop'){ sirenStop(); return true; }
  if(t.id === 'sircfg'){ SIR.cfgOpen = !SIR.cfgOpen; render(); return true; }
  const v = S.sess.kiosco.who; if(roleOf(v) !== 'admin') return false;
  if(t.id === 'sc_save' || t.id === 'sc_conn' || t.id === 'sc_test'){
    const c = { modo: $('#sc_modo').value, sonido: $('#sc_son').checked, toque: +$('#sc_toque').value, pausa: +$('#sc_pausa').value,
      maxCont: +$('#sc_max').value, baud: +$('#sc_baud').value, on: $('#sc_on').value.trim(), off: $('#sc_off').value.trim() };
    if(!(c.toque >= 1 && c.toque <= 30 && c.pausa >= 1 && c.pausa <= 30 && c.maxCont >= 5 && c.maxCont <= 600)){ toast('Revisá los tiempos: toque y pausa de 1 a 30 s, continua de 5 a 600 s.'); return true; }
    if(c.modo === 'serial'){ try { hexBytes(c.on); hexBytes(c.off); } catch(e){ toast(e.message); return true; } }
    if(c.modo !== sirCfg().modo){ SIR.port = null; SIR.hid = null; }
    LS.set('bviv_sirena', JSON.stringify(c));
    if(t.id === 'sc_save'){ toast('Configuración de la sirena guardada en esta PC.'); render(); return true; }
    if(t.id === 'sc_conn'){
      if(c.modo === 'sim'){ toast('En modo simulación no hace falta conectar nada.'); return true; }
      try { await relay.connect(true); toast('Relé conectado.'); } catch(e){ toast(e.message); }
      return true;
    }
    if(t.id === 'sc_test'){
      if(SIR.run) return true;
      try { SIR.run = 'prueba'; sirLog('prueba'); await relay.set(true); await sleep(1000); await relay.set(false); toast('Prueba terminada.'); }
      catch(e){ toast('Sirena: ' + e.message); }
      finally { sirSound.stop(); SIR.run = null; }
      return true;
    }
  }
  return false;
}
