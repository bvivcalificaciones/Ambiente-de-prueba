/* =====================================================================
   Documentos PDF oficiales para imprimir y firmar.
   Usa pdf-lib (vendor/pdf-lib.min.js, licencia MIT), incluido en la app:
   no depende de ningún servicio externo.
   Deja libre el espacio de la hoja membretada (márgenes en Personal → Configuración).
   ===================================================================== */
const MM = 72 / 25.4;
const PDFC = {
  red:[200,16,46], ink:[17,17,17], green:[29,107,53], gsoft:[220,239,225], ydark:[224,160,0], yellow:[255,199,44],
  gray:[95,90,86], light:[240,237,233], line:[196,190,184], white:[255,255,255],
  blue:[31,95,168], orange:[228,106,27], purple:[107,63,160], teal:[19,138,138], brown:[138,90,43], silver:[160,160,160]
};
const PIE_COLORS = ['red','ink','ydark','green','blue','orange','purple','teal','brown','silver'];

// Las fuentes estándar de PDF solo admiten caracteres latinos (incluye á, é, ñ, ü, °, ·).
function pdfSafe(s){
  return String(s ?? '').replace(/→/g,'->').replace(/[✓✔]/g,'OK').replace(/\s+/g,' ')
    .replace(/[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g,'?');
}
const fechaL = s => { const d = P(s); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; };
const ahoraL = () => new Date().toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const pct0 = v => v == null ? '—' : Math.round(v*100) + '%';

class Doc {
  static async create(title, emisor){ const d = new Doc(); await d.init(title, emisor); return d; }
  async init(title, emisor){
    if(typeof PDFLib === 'undefined') throw new Error('No se pudo cargar el generador de PDF. Recargá la página.');
    const { PDFDocument, StandardFonts } = PDFLib;
    this.title = title; this.emisor = emisor;
    this.doc = await PDFDocument.create();
    this.f = await this.doc.embedFont(StandardFonts.Helvetica);
    this.b = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.doc.setTitle(pdfSafe(title)); this.doc.setAuthor('Asoc. Bomberos Voluntarios Isla Verde');
    this.doc.setCreator('App del cuartel'); this.doc.setProducer('App del cuartel'); this.doc.setLanguage('es-AR');
    this.W = 595.28; this.H = 841.89; this.L = 18*MM; this.R = this.W - 18*MM;
    const sup = +S.cfg.membreteSup, inf = +S.cfg.membreteInf;
    this.top = this.H - (isNaN(sup) ? 40 : sup)*MM;
    this.footerY = ((isNaN(inf) ? 20 : inf) + 4)*MM;
    this.bottom = this.footerY + 14;
    this.pages = []; this.newPage();
  }
  newPage(){ this.p = this.doc.addPage([this.W, this.H]); this.pages.push(this.p); this.y = this.top; }
  ensure(h){ if(this.y - h < this.bottom){ this.newPage(); return true; } return false; }
  col(c){ const v = PDFC[c] || c; return PDFLib.rgb(v[0]/255, v[1]/255, v[2]/255); }
  font(bold){ return bold ? this.b : this.f; }
  tw(t, size, bold){ return this.font(bold).widthOfTextAtSize(pdfSafe(t), size); }
  fit(t, size, bold, maxW){
    let s = pdfSafe(t); const f = this.font(bold);
    if(f.widthOfTextAtSize(s, size) <= maxW) return s;
    while(s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  text(t, x, y, o = {}){
    const size = o.size || 9, bold = !!o.bold, f = this.font(bold);
    const s = o.maxW ? this.fit(t, size, bold, o.maxW) : pdfSafe(t);
    const w = f.widthOfTextAtSize(s, size);
    const xx = o.align === 'right' ? x - w : o.align === 'center' ? x - w/2 : x;
    this.p.drawText(s, { x: xx, y, size, font: f, color: this.col(o.color || 'ink') });
  }
  wrap(t, size, maxW, bold){
    const words = pdfSafe(t).split(' '); const lines = []; let cur = '';
    for(const w of words){ const nx = cur ? cur + ' ' + w : w; if(this.tw(nx, size, bold) > maxW && cur){ lines.push(cur); cur = w; } else cur = nx; }
    if(cur) lines.push(cur); return lines;
  }
  rect(x, y, w, h, fill, border){
    this.p.drawRectangle({ x, y, width: w, height: h, color: fill ? this.col(fill) : undefined,
      borderColor: border ? this.col(border) : undefined, borderWidth: border ? 0.6 : 0 });
  }
  line(x1, y1, x2, y2, c = 'line', t = 0.6, dash){
    this.p.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness:t, color:this.col(c), dashArray: dash });
  }

  /* ---- bloques ---- */
  header(main, sub, info){
    this.rect(this.L, this.y - 3, this.R - this.L, 3, 'red');
    this.y -= 3 + 20; this.text(main, this.L, this.y, { size: 17, bold: true });
    if(sub){ this.y -= 17; this.text(sub, this.L, this.y, { size: 12, bold: true, color: 'red' }); }
    this.y -= 12;
    const colW = (this.R - this.L) / 2;
    for(let i = 0; i < info.length; i += 2){
      this.y -= 22;
      for(let j = 0; j < 2 && i + j < info.length; j++){
        const [k, v] = info[i + j], x = this.L + j*colW;
        this.text(k.toUpperCase(), x, this.y + 10, { size: 6.5, bold: true, color: 'gray' });
        this.text(v, x, this.y, { size: 9.5, bold: true, maxW: colW - 8 });
      }
    }
    this.y -= 9; this.line(this.L, this.y, this.R, this.y, 'line', 0.8); this.y -= 6;
  }
  kpis(items){
    const h = 46, gap = 6, w = (this.R - this.L - gap*(items.length - 1)) / items.length;
    this.ensure(h + 10); this.y -= 6;
    items.forEach(([v, k, warn], i) => {
      const x = this.L + i*(w + gap);
      this.rect(x, this.y - h, w, h, 'light');
      this.rect(x, this.y - 3, w, 3, warn ? 'ydark' : 'red');
      this.text(v, x + 8, this.y - 24, { size: 16, bold: true, maxW: w - 12 });
      this.wrap(k, 7, w - 14).slice(0, 2).forEach((ln, j) => this.text(ln, x + 8, this.y - 34 - j*8, { size: 7, color: 'gray' }));
    });
    this.y -= h + 6;
  }
  section(t, min = 40){
    this.ensure(min); this.y -= 16;
    this.text(t.toUpperCase(), this.L, this.y, { size: 9.5, bold: true });
    this.y -= 5; this.line(this.L, this.y, this.R, this.y, 'red', 1); this.y -= 6;
  }
  note(t){ for(const ln of this.wrap(t, 7.5, this.R - this.L)){ this.ensure(11); this.y -= 10; this.text(ln, this.L, this.y, { size: 7.5, color: 'gray' }); } }

  /* cols: [{h, w, align}]  ·  celdas: valor o {t, fill, color, bold} */
  table(cols, rows, o = {}){
    const size = o.size || 8, rh = o.rh || 15, hh = o.hh || 17;
    const fixed = cols.reduce((s, c) => s + (c.w || 0), 0), flex = cols.filter(c => !c.w).length;
    const fw = flex ? (this.R - this.L - fixed) / flex : 0;
    const ws = cols.map(c => c.w || fw);
    const drawHead = () => {
      this.rect(this.L, this.y - hh, this.R - this.L, hh, 'ink');
      let x = this.L;
      cols.forEach((c, i) => {
        const lines = this.wrap(c.h, 7, ws[i] - 6, true).slice(0, 2);
        lines.forEach((ln, j) => {
          const ty = this.y - (lines.length === 1 ? 11 : 7.5 + j*7.5);
          const al = c.align || 'left';
          const tx = al === 'right' ? x + ws[i] - 4 : al === 'center' ? x + ws[i]/2 : x + 4;
          this.text(ln, tx, ty, { size: 7, bold: true, color: 'white', align: al });
        });
        x += ws[i];
      });
      this.y -= hh;
    };
    const total = hh + rows.length*rh;
    if(total < (this.top - this.bottom)*0.6) this.ensure(total + 4); else this.ensure(hh + rh*2);
    drawHead();
    rows.forEach((r, ri) => {
      if(this.ensure(rh)) drawHead();
      const total = o.totalLast && ri === rows.length - 1;
      if(total) this.rect(this.L, this.y - rh, this.R - this.L, rh, 'light');
      else if(ri % 2) this.rect(this.L, this.y - rh, this.R - this.L, rh, [249,247,245]);
      let x = this.L;
      r.forEach((cell, i) => {
        const c = typeof cell === 'object' && cell !== null ? cell : { t: cell };
        if(c.fill) this.rect(x + 1.5, this.y - rh + 1.5, ws[i] - 3, rh - 3, c.fill);
        const al = c.align || cols[i].align || 'left';
        const tx = al === 'right' ? x + ws[i] - 4 : al === 'center' ? x + ws[i]/2 : x + 4;
        this.text(c.t ?? '', tx, this.y - rh + (rh - size)/2 + 1.5,
          { size, bold: total || c.bold, color: c.color || 'ink', align: al, maxW: ws[i] - 6 });
        x += ws[i];
      });
      this.line(this.L, this.y - rh, this.R, this.y - rh, 'line', 0.3);
      this.y -= rh;
    });
    this.y -= 4;
  }

  /* ---- gráficos (se dibujan dentro de una caja; no mueven el cursor) ---- */
  chartTitle(t, x, y, w){ this.text(t, x, y - 9, { size: 8.5, bold: true, maxW: w }); }
  niceMax(v){ if(v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  bars(box, { title, labels, series, fmt = v => String(Math.round(v)) }){
    const { x, y, w, h } = box; this.chartTitle(title, x, y, w);
    // leyenda debajo del título
    let lx = x;
    if(series.length > 1) series.forEach(s => { this.rect(lx, y - 20.5, 7, 7, s.color); this.text(s.name, lx + 10, y - 20, { size: 7, color: 'gray' }); lx += this.tw(s.name, 7) + 22; });
    const pl = x + 26, pr = x + w - 4, pt = y - 32, pb = y - h + 20, ph = pt - pb;
    const max = this.niceMax(Math.max(0, ...series.flatMap(s => s.values)));
    for(let i = 0; i <= 4; i++){
      const yy = pb + ph*i/4; this.line(pl, yy, pr, yy, i ? [228,224,220] : 'gray', i ? 0.4 : 0.7);
      this.text(fmt(max*i/4), pl - 3, yy - 2.5, { size: 6.5, color: 'gray', align: 'right' });
    }
    const gw = (pr - pl) / Math.max(1, labels.length), bw = Math.min(16, gw*0.75 / series.length);
    labels.forEach((lb, i) => {
      const gx = pl + gw*i + (gw - bw*series.length)/2;
      series.forEach((s, j) => {
        const v = s.values[i] || 0, bh = ph * v / max, bx = gx + j*bw;
        if(bh > 0) this.rect(bx, pb, bw - 1, bh, s.color);
        if(v > 0 && gw > 22) this.text(fmt(v), bx + (bw - 1)/2, pb + bh + 2, { size: 6, align: 'center', color: 'gray' });
      });
      this.text(lb, pl + gw*i + gw/2, pb - 9, { size: 6.5, align: 'center', maxW: gw - 2 });
    });
  }
  hbars(box, { title, items, color = 'red', fmt = v => String(Math.round(v)) }){
    const { x, y, w } = box; this.chartTitle(title, x, y, w);
    const lw = 128, max = this.niceMax(Math.max(0, ...items.map(i => i.value))), bw = w - lw - 34;
    items.forEach((it, i) => {
      const yy = y - 22 - i*11;
      this.text(it.label, x + lw - 4, yy - 2, { size: 7, align: 'right', maxW: lw - 6 });
      const l = bw * it.value / max; if(l > 0) this.rect(x + lw, yy - 4, l, 8, it.color || color);
      this.text(fmt(it.value), x + lw + l + 3, yy - 2, { size: 7, bold: true });
    });
    return 26 + items.length*11;
  }
  pie(box, { title, items, fmt = v => String(Math.round(v)) }){
    const { x, y, w, h } = box; this.chartTitle(title, x, y, w);
    const data = items.filter(i => i.value > 0), tot = data.reduce((s, i) => s + i.value, 0);
    const r = Math.min(h - 34, w*0.34) / 2, cx = x + r + 2, cy = y - 22 - r;
    if(!tot){ this.text('Sin datos en el período.', x, y - 30, { size: 8, color: 'gray' }); return; }
    let a = -Math.PI/2;
    for(const it of data){
      const frac = it.value / tot, col = this.col(it.color);
      if(frac >= 0.9999){ this.p.drawCircle({ x: cx, y: cy, size: r, color: col }); break; }
      const a2 = a + frac*2*Math.PI, large = frac > 0.5 ? 1 : 0;
      const p1 = [r + r*Math.cos(a), r + r*Math.sin(a)], p2 = [r + r*Math.cos(a2), r + r*Math.sin(a2)];
      this.p.drawSvgPath(`M ${r} ${r} L ${p1[0]} ${p1[1]} A ${r} ${r} 0 ${large} 1 ${p2[0]} ${p2[1]} Z`,
        { x: cx - r, y: cy + r, color: col, borderColor: this.col('white'), borderWidth: 0.8 });
      a = a2;
    }
    const lx = cx + r + 12, lw = x + w - lx;
    data.forEach((it, i) => {
      const yy = y - 26 - i*11;
      this.rect(lx, yy - 1, 7, 7, it.color);
      this.text(it.label, lx + 10, yy, { size: 7, maxW: lw - 54 });
      this.text(`${fmt(it.value)} · ${Math.round(it.value/tot*100)}%`, x + w, yy, { size: 7, bold: true, align: 'right' });
    });
  }
  chartsRow(h, ...draws){
    this.ensure(h + 6); this.y -= 6;
    const gap = 14, w = (this.R - this.L - gap*(draws.length - 1)) / draws.length;
    draws.forEach((fn, i) => fn({ x: this.L + i*(w + gap), y: this.y, w, h }));
    this.y -= h;
  }
  observaciones(n = 3){
    this.section('Observaciones');
    for(let i = 0; i < n; i++){ this.ensure(20); this.y -= 18; this.line(this.L, this.y, this.R, this.y, 'line', 0.5, [2, 2]); }
  }
  firmas(slots){
    this.ensure(110); this.y -= 62;
    const w = (this.R - this.L) / slots.length;
    slots.forEach((s, i) => {
      const cx = this.L + w*i + w/2, lw = Math.min(170, w - 24);
      this.line(cx - lw/2, this.y, cx + lw/2, this.y, 'ink', 0.8);
      this.text(s.label, cx, this.y - 12, { size: 8.5, bold: true, align: 'center' });
      if(s.name) this.text(s.name, cx, this.y - 23, { size: 8.5, align: 'center' });
      else { this.text('Aclaración:', cx - lw/2, this.y - 26, { size: 7.5, color: 'gray' });
             this.line(cx - lw/2 + 40, this.y - 27, cx + lw/2, this.y - 27, 'line', 0.5); }
      this.text(s.sub || 'Firma y sello', cx, this.y - (s.name ? 33 : 40), { size: 7, color: 'gray', align: 'center' });
    });
    this.y -= 46;
  }
  // Párrafo con título chico (para textos largos del parte de intervención).
  para(label, t){
    const txt = String(t ?? '').trim(); if(!txt) return;
    this.ensure(28); this.y -= 12;
    this.text(label.toUpperCase(), this.L, this.y, { size: 6.8, bold: true, color: 'gray' });
    for(const par of txt.split(/\n+/)) for(const ln of this.wrap(par, 9.5, this.R - this.L)){ this.ensure(13); this.y -= 12.5; this.text(ln, this.L, this.y, { size: 9.5 }); }
    this.y -= 2;
  }
  async image(dataUrl, caption){
    const b64 = dataUrl.split(',')[1], bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const img = /^data:image\/png/.test(dataUrl) ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
    const maxW = this.R - this.L, maxH = Math.min(380, this.top - this.bottom - 30);
    const sc = Math.min(maxW / img.width, maxH / img.height, 1.5), w = img.width * sc, h = img.height * sc;
    this.ensure(h + 26); this.y -= 8;
    this.p.drawImage(img, { x: this.L + (maxW - w) / 2, y: this.y - h, width: w, height: h });
    this.rect(this.L + (maxW - w) / 2, this.y - h, w, h, null, 'line');
    this.y -= h + 11; this.text(caption, this.L + maxW / 2, this.y, { size: 8, color: 'gray', align: 'center' }); this.y -= 4;
  }
  async save(filename){
    const n = this.pages.length;
    this.pages.forEach((p, i) => {
      this.p = p;
      this.line(this.L, this.footerY + 9, this.R, this.footerY + 9, 'line', 0.4);
      const der = `Emitido ${ahoraL()} por ${this.emisor} · Página ${i + 1} de ${n}`;
      this.text(der, this.R, this.footerY, { size: 6.5, color: 'gray', align: 'right' });
      this.text(`Asoc. Bomberos Voluntarios Isla Verde · ${this.title}`, this.L, this.footerY, { size: 6.5, color: 'gray', maxW: this.R - this.L - this.tw(der, 6.5) - 14 });
    });
    const bytes = await this.doc.save();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

/* ---- utilidades compartidas ---- */
const jefatura = () => ({
  jefe: S.roster.find(p => p.activo && p.cargo === 'Jefe'),
  sub: S.roster.find(p => p.activo && p.cargo === 'Sub Jefe')
});
const firmasJefatura = () => { const j = jefatura();
  return [{ label: 'Jefe del Cuerpo Activo', name: j.jefe ? nombreConGrado(j.jefe.n) : '' }, { label: 'Sub Jefe del Cuerpo Activo', name: j.sub ? nombreConGrado(j.sub.n) : '' }]; };
const firmaSuperior = () => [{ label: 'Superior de Guardia', sub: 'Firma' }];
const ST_PDF = {
  completa: { t: 'Completa', fill: 'green', color: 'white' }, parcial: { t: 'Parcial', fill: 'yellow' },
  ausente: { t: 'No va', fill: 'red', color: 'white' }, sin: { t: 'Sin reg.', fill: 'ink', color: 'yellow' },
  cub: { t: 'Cubre', fill: 'gsoft', color: 'green' }
};
function leyendaNoches(d){
  d.ensure(14); d.y -= 10; let x = d.L;
  for(const k of ['completa','parcial','ausente','cub','sin']){
    const s = ST_PDF[k]; d.rect(x, d.y - 1, 9, 8, s.fill); x += 12;
    const lb = { completa:'Completa', parcial:'Parcial', ausente:'No va (dejó reemplazo)', cub:'Cubre a otro', sin:'Sin registro' }[k];
    d.text(lb, x, d.y, { size: 7, color: 'gray' }); x += d.tw(lb, 7) + 14;
  }
  d.text('* registrado después de las 20:00', d.R, d.y, { size: 7, color: 'gray', align: 'right' });
}
const mesC = k => MESES[+k.slice(5) - 1].slice(0, 3) + (k.slice(2, 4) !== String(new Date().getFullYear()).slice(2) ? ' ' + k.slice(2, 4) : '');
const ubicTxt = p => p.cargo ? 'Jefatura · ' + p.cargo : p.g ? 'Guardia ' + p.g : 'Sin guardia';
async function generar(fn){
  if(S.busy) return; S.busy = true; toast('Generando PDF…');
  try { await fn(); toast('PDF descargado.'); }
  catch(e){ console.error(e); toast('No se pudo generar el PDF: ' + e.message); }
  finally { S.busy = false; }
}

/* =====================================================================
   1) Planilla SEMANAL de guardia · firma Superior de Guardia
   ===================================================================== */
function pdfSemana(viewer){ return generar(async () => {
  const w = weekStarts(scopeOf(viewer)).find(x => x.start === S.week); if(!w) throw new Error('Elegí una semana.');
  const W = weekData(w), T = W.tot, fin = addDays(w.start, 7);
  const d = await Doc.create(`Planilla semanal Guardia ${w.g} · ${fechaL(w.start)}`, nice(viewer));
  d.header('PLANILLA SEMANAL DE GUARDIA', `Guardia ${w.g}`, [
    ['Período', `Del ${fechaL(w.start)} 20:00 al ${fechaL(fin)} 19:59`],
    ['Horario de guardia activa', 'De 20:00 a 07:00, todas las noches'],
    ['Integrantes', String(W.rows.filter(r => !r.helper).length)],
    ['Reemplazos de la otra guardia', String(W.rows.filter(r => r.helper).length)]]);
  d.kpis([[String(T.total), `guardias cumplidas (${T.cub} como reemplazo)`], [String(T.par), 'parciales'],
    [String(T.aus), 'ausencias con reemplazo'], [String(T.sin), `noches sin registro · ${T.late} fuera de hora`, true],
    [fmtH(T.cap + T.mant), 'h de capacitación y mantenimiento']]);
  d.section('Asistencia por noche');
  const cols = [{ h: 'Integrante' }, ...W.nights.map(n => ({ h: `${DIAS[P(n).getDay()]} ${ddmm(n)}`, w: 46, align: 'center' })), { h: 'Total', w: 34, align: 'right' }];
  d.table(cols, W.rows.map(r => [
    { t: r.n + (r.helper ? ` (G${3 - w.g})` : ''), color: r.helper ? 'gray' : 'ink' },
    ...r.cells.map(c => { const k = c.st && ST_PDF[c.st] ? c.st : c.c === 'cub' ? 'cub' : null;
      return k ? { ...ST_PDF[k], t: ST_PDF[k].t + (c.late ? '*' : '') } : { t: c.t === 'Pendiente' ? 'Pend.' : c.t ? '—' : '', color: 'gray' }; }),
    { t: String(r.total), bold: true }]), { rh: 16 });
  leyendaNoches(d);
  const presentes = W.nights.map(n => W.rows.reduce((s, r) => { const c = r.cells.find(x => x.n === n); return s + (c && (c.st === 'completa' || c.st === 'parcial' || c.c === 'cub') ? 1 : 0); }, 0));
  d.chartsRow(150,
    b => d.bars(b, { title: 'Presentes por noche', labels: W.nights.map(n => `${DIAS[P(n).getDay()]} ${P(n).getDate()}`), series: [{ name: 'Presentes', color: 'red', values: presentes }] }),
    b => d.pie(b, { title: 'Distribución de las noches', items: [
      { label: 'Completas', value: T.comp, color: 'green' }, { label: 'Parciales', value: T.par, color: 'ydark' },
      { label: 'Como reemplazo', value: T.cub, color: 'teal' }, { label: 'Ausencias con reemplazo', value: T.aus, color: 'red' },
      { label: 'Sin registro', value: T.sin, color: 'ink' }] }));
  d.section('Reemplazos');
  if(W.reps.length) d.table([{ h: 'Noche', w: 62 }, { h: 'Titular' }, { h: 'Reemplazante' }, { h: 'Tipo', w: 50 }, { h: 'Horario', w: 110 }],
    W.reps.map(r => [`${DIAS[P(r.n).getDay()]} ${ddmm(r.n)}`, r.por, r.b, r.parcial ? 'Parcial' : 'Total', r.horario || '—']));
  else d.note('Sin reemplazos en la semana.');
  d.section('Capacitación y mantenimiento de la guardia');
  if(W.acts.length) d.table([{ h: 'Fecha', w: 70 }, { h: 'Integrante', w: 130 }, { h: 'Actividad', w: 80 }, { h: 'Temática / tareas' }, { h: 'Horas', w: 40, align: 'right' }],
    [...W.acts.map(h => [fmtD(h.i), h.b, h.m === CAP ? 'Capacitación' : 'Mantenimiento', h.d || '—', fmtH(hrs(h))]),
     ['Total', '', '', '', fmtH(T.cap + T.mant)]], { totalLast: true });
  else d.note('Sin actividades cargadas en la semana.');
  d.observaciones(3);
  d.firmas(firmaSuperior());
  await d.save(`Guardia${w.g}_semana_${w.start}.pdf`);
}); }

/* =====================================================================
   2) Planilla MENSUAL de guardia · firma Superior (o Jefatura si es todo el cuerpo)
   ===================================================================== */
function pdfMesGuardia(viewer){ return generar(async () => {
  const mk = S.month, gf = gfFor(viewer), [y, m] = mk.split('-');
  const rows = rowsFor(mk, viewer).filter(r => member(r.n)?.activo).map(r => ({ ...r, cap: guardHours(r.n, mk, CAP), mant: guardHours(r.n, mk, MANT) }));
  const sum = k => rows.reduce((s, r) => s + r[k], 0);
  const T = { total: sum('total'), comp: sum('comp'), par: sum('par'), aus: sum('aus'), sin: sum('sin'), late: sum('late'), reps: sum('reps'), cap: sum('cap'), mant: sum('mant') };
  const quien = gf === '1' || gf === '2' ? `Guardia ${gf}` : gf === '0' ? 'Sin guardia y jefatura' : 'Guardias 1 y 2';
  const d = await Doc.create(`Planilla mensual ${quien} · ${MESES[+m - 1]} ${y}`, nice(viewer));
  d.header('PLANILLA MENSUAL DE GUARDIA', quien, [['Mes', `${MESES[+m - 1]} ${y}`], ['Integrantes', String(rows.length)]]);
  d.kpis([[String(T.total), `guardias cumplidas (${T.reps} como reemplazo)`], [String(T.par), 'parciales'],
    [String(T.aus), 'ausencias con reemplazo'], [String(T.sin), `noches sin registro · ${T.late} fuera de hora`, true],
    [fmtH(T.cap + T.mant), 'h de capacitación y mantenimiento']]);
  const top = [...rows].sort((a, b) => b.total - a.total || a.n.localeCompare(b.n, 'es'));
  const hH = 26 + top.length*11;
  d.ensure(hH + 6); d.y -= 6;
  const half = (d.R - d.L - 14) / 2;
  d.hbars({ x: d.L, y: d.y, w: half }, { title: 'Guardias cumplidas por integrante', items: top.map(r => ({ label: r.n, value: r.total })) });
  d.pie({ x: d.L + half + 14, y: d.y, w: half, h: 170 }, { title: 'Estado de las noches', items: [
    { label: 'Completas', value: T.comp, color: 'green' }, { label: 'Parciales', value: T.par, color: 'ydark' },
    { label: 'Como reemplazo', value: T.reps, color: 'teal' }, { label: 'Ausencias con reemplazo', value: T.aus, color: 'red' },
    { label: 'Sin registro', value: T.sin, color: 'ink' }] });
  d.y -= Math.max(hH, 170);
  d.section('Detalle por integrante');
  d.table([{ h: 'Integrante' }, { h: 'Gdia.', w: 32, align: 'center' }, { h: 'Guardias', w: 44, align: 'right' }, { h: 'Propias', w: 40, align: 'right' },
           { h: 'Reemp.', w: 38, align: 'right' }, { h: 'Parc.', w: 32, align: 'right' }, { h: 'Aus.', w: 30, align: 'right' },
           { h: 'Sin reg.', w: 38, align: 'right' }, { h: 'F. hora', w: 36, align: 'right' }, { h: 'H. cap.', w: 38, align: 'right' }, { h: 'H. mant.', w: 40, align: 'right' }],
    [...rows.map(r => [r.n, r.g || '—', { t: String(r.total), bold: true }, r.comp + r.par, r.reps, r.par, r.aus,
        r.sin ? { t: String(r.sin), color: 'red', bold: true } : '0', r.late, fmtH(r.cap), fmtH(r.mant)]),
     ['Total', '', String(T.total), T.comp + T.par, T.reps, T.par, T.aus, T.sin, T.late, fmtH(T.cap), fmtH(T.mant)]], { totalLast: true });
  d.observaciones(3);
  d.firmas(gf === '1' || gf === '2' ? firmaSuperior() : firmasJefatura());
  await d.save(`Guardia_${gf === 'all' ? 'todas' : gf}_${mk}.pdf`);
}); }

/* =====================================================================
   3) Resumen OFICIAL (individual o de todo el cuerpo) · firma Jefe y Sub Jefe
   ===================================================================== */
function pdfOficial(viewer){ return generar(async () => {
  if(!canAsist(viewer)) throw new Error('Sin permiso.');
  const R = S.rep; if(R.from > R.to) throw new Error('Revisá el período.');
  const ks = monthsBetween(R.from, R.to), periodo = `${mesL(R.from)} a ${mesL(R.to)}`;
  return R.b ? pdfIndividual(viewer, R.b, ks, periodo) : pdfCuerpo(viewer, ks, periodo);
}); }

function agPorActividad(names, ks){
  const by = {};
  for(const n of names) for(const k of ks) for(const [mo, h] of Object.entries(agStats(n, k).by)) by[mo] = (by[mo] || 0) + h;
  const items = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const top = items.slice(0, 8).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i] }));
  const rest = items.slice(8).reduce((s, x) => s + x[1], 0);
  if(rest > 0) top.push({ label: 'Otras actividades', value: rest, color: 'silver' });
  return { items, pie: top };
}

async function pdfIndividual(viewer, b, ks, periodo){
  const p = member(b), X = personPeriod(b, ks), T = X.tot;
  const d = await Doc.create(`Resumen de actividad · ${b} · ${periodo}`, nice(viewer));
  d.header('RESUMEN DE ACTIVIDAD', b, [['Categoría', p.cat], ['Ubicación', ubicTxt(p)], ['Período', periodo], ['Meses incluidos', String(ks.length)]]);
  d.kpis([[String(T.total), `guardias cumplidas (${T.reps} como reemplazo)`], [pct0(X.cumpl), 'cumplimiento de sus noches de guardia'],
    [String(T.sin), `noches sin registro · ${T.late} fuera de hora`, true], [fmtH(T.cap + T.mant), 'h de capacitación y mantenimiento'],
    [fmtH(T.ag), 'h de asistencia general']]);
  const labels = ks.map(mesC);
  d.chartsRow(160,
    bx => d.bars(bx, { title: 'Guardias cumplidas por mes', labels, series: [
      { name: 'Propias', color: 'red', values: X.per.map(r => r.comp + r.par) }, { name: 'Como reemplazo', color: 'ink', values: X.per.map(r => r.reps) }] }),
    bx => d.bars(bx, { title: 'Horas por mes', labels, fmt: v => fmtH(v).replace(/:00$/, ''), series: [
      { name: 'Guardia (cap. y mant.)', color: 'ydark', values: X.per.map(r => r.cap + r.mant) }, { name: 'Asistencia general', color: 'red', values: X.per.map(r => r.ag.tot) }] }));
  const AG = agPorActividad([b], ks);
  d.chartsRow(150,
    bx => d.pie(bx, { title: 'Noches de guardia', items: [
      { label: 'Completas', value: X.per.reduce((s, r) => s + r.comp, 0), color: 'green' }, { label: 'Parciales', value: T.par, color: 'ydark' },
      { label: 'Como reemplazo', value: T.reps, color: 'teal' }, { label: 'Ausencias con reemplazo', value: T.aus, color: 'red' },
      { label: 'Sin registro', value: T.sin, color: 'ink' }] }),
    bx => d.pie(bx, { title: 'Asistencia general por actividad (horas)', items: AG.pie, fmt: fmtH }));
  d.section('Detalle mensual');
  d.table([{ h: 'Mes' }, { h: 'Guardias', w: 42, align: 'right' }, { h: 'Propias', w: 38, align: 'right' }, { h: 'Reemp.', w: 36, align: 'right' },
           { h: 'Parc.', w: 30, align: 'right' }, { h: 'Aus.', w: 30, align: 'right' }, { h: 'Sin reg.', w: 36, align: 'right' }, { h: 'F. hora', w: 34, align: 'right' },
           { h: 'H. cap.', w: 38, align: 'right' }, { h: 'H. mant.', w: 40, align: 'right' }, { h: 'H. asist. gral.', w: 50, align: 'right' }],
    [...X.per.map(r => [mesL(r.k), { t: String(r.total), bold: true }, r.comp + r.par, r.reps, r.par, r.aus,
        r.sin ? { t: String(r.sin), color: 'red', bold: true } : '0', r.late, fmtH(r.cap), fmtH(r.mant), fmtH(r.ag.tot)]),
     ['Total', String(T.total), T.propias, T.reps, T.par, T.aus, T.sin, T.late, fmtH(T.cap), fmtH(T.mant), fmtH(T.ag)]], { totalLast: true });
  if(AG.items.length){
    d.section('Asistencia general por actividad');
    const showMonths = ks.length <= 8;
    const cols = [{ h: 'Actividad' }, ...(showMonths ? ks.map(k => ({ h: mesC(k), w: 38, align: 'right' })) : []), { h: 'Total', w: 44, align: 'right' }];
    const rows = AG.items.map(([mo, h]) => [mo, ...(showMonths ? ks.map(k => { const v = agStats(b, k).by[mo] || 0; return v ? fmtH(v) : { t: '—', color: 'gray' }; }) : []), { t: fmtH(h), bold: true }]);
    rows.push(['Total', ...(showMonths ? X.per.map(r => fmtH(r.ag.tot)) : []), fmtH(T.ag)]);
    d.table(cols, rows, { totalLast: true });
  }
  d.note('Guardias cumplidas = noches completas o parciales de su guardia más las noches que cubrió como reemplazo. Cumplimiento = noches presentes sobre noches asignadas a su guardia.');
  d.firmas(firmasJefatura());
  await d.save(`Resumen_${b.replace(/\s+/g, '_')}_${ks[0]}_a_${ks[ks.length - 1]}.pdf`);
}

async function pdfCuerpo(viewer, ks, periodo){
  const ppl = active();
  const data = ppl.map(p => ({ p, X: personPeriod(p.n, ks) }));
  const sum = f => data.reduce((s, x) => s + f(x), 0);
  const T = { total: sum(x => x.X.tot.total), reps: sum(x => x.X.tot.reps), propias: sum(x => x.X.tot.propias), asign: sum(x => x.X.tot.asign),
    sin: sum(x => x.X.tot.sin), late: sum(x => x.X.tot.late), cap: sum(x => x.X.tot.cap), mant: sum(x => x.X.tot.mant), ag: sum(x => x.X.tot.ag),
    par: sum(x => x.X.tot.par), aus: sum(x => x.X.tot.aus) };
  const d = await Doc.create(`Resumen general del cuerpo activo · ${periodo}`, nice(viewer));
  d.header('RESUMEN GENERAL DEL CUERPO ACTIVO', periodo, [['Integrantes', String(ppl.length)], ['Meses incluidos', String(ks.length)]]);
  d.kpis([[String(T.total), `guardias cumplidas (${T.reps} como reemplazo)`], [pct0(T.asign ? T.propias / T.asign : null), 'cumplimiento de noches asignadas'],
    [String(T.sin), `noches sin registro · ${T.late} fuera de hora`, true], [fmtH(T.cap + T.mant), 'h de capacitación y mantenimiento'],
    [fmtH(T.ag), 'h de asistencia general']]);
  const labels = ks.map(mesC), perMes = k => data.map(x => x.X.per.find(r => r.k === k));
  d.chartsRow(160,
    bx => d.bars(bx, { title: 'Guardias cumplidas por mes', labels, series: [
      { name: 'Propias', color: 'red', values: ks.map(k => perMes(k).reduce((s, r) => s + r.comp + r.par, 0)) },
      { name: 'Como reemplazo', color: 'ink', values: ks.map(k => perMes(k).reduce((s, r) => s + r.reps, 0)) }] }),
    bx => d.bars(bx, { title: 'Horas por mes', labels, fmt: v => String(Math.round(v)), series: [
      { name: 'Guardia (cap. y mant.)', color: 'ydark', values: ks.map(k => perMes(k).reduce((s, r) => s + r.cap + r.mant, 0)) },
      { name: 'Asistencia general', color: 'red', values: ks.map(k => perMes(k).reduce((s, r) => s + r.ag.tot, 0)) }] }));
  const AG = agPorActividad(ppl.map(p => p.n), ks);
  d.chartsRow(150,
    bx => d.pie(bx, { title: 'Noches de guardia del cuerpo', items: [
      { label: 'Completas', value: sum(x => x.X.per.reduce((s, r) => s + r.comp, 0)), color: 'green' }, { label: 'Parciales', value: T.par, color: 'ydark' },
      { label: 'Como reemplazo', value: T.reps, color: 'teal' }, { label: 'Ausencias con reemplazo', value: T.aus, color: 'red' },
      { label: 'Sin registro', value: T.sin, color: 'ink' }] }),
    bx => d.pie(bx, { title: 'Asistencia general por actividad (horas)', items: AG.pie, fmt: v => String(Math.round(v)) }));
  const rank = [...data].sort((a, b) => b.X.tot.total - a.X.tot.total || a.p.n.localeCompare(b.p.n, 'es'));
  const hH = 26 + rank.length*11;
  d.ensure(hH + 6); d.y -= 6;
  d.hbars({ x: d.L, y: d.y, w: d.R - d.L }, { title: 'Guardias cumplidas por integrante', items: rank.map(x => ({ label: x.p.n, value: x.X.tot.total })) });
  d.y -= hH;
  d.section('Detalle por integrante');
  d.table([{ h: 'Integrante' }, { h: 'Ubic.', w: 40, align: 'center' }, { h: 'Guardias', w: 42, align: 'right' }, { h: 'Reemp.', w: 36, align: 'right' },
           { h: 'Aus.', w: 30, align: 'right' }, { h: 'Sin reg.', w: 36, align: 'right' }, { h: 'F. hora', w: 34, align: 'right' }, { h: '% cumpl.', w: 40, align: 'right' },
           { h: 'H. guardia', w: 44, align: 'right' }, { h: 'H. asist. gral.', w: 52, align: 'right' }],
    [...data.map(({ p, X }) => [p.n, p.cargo ? (p.cargo === 'Jefe' ? 'Jefe' : 'S. Jefe') : p.g ? 'G' + p.g : '—', { t: String(X.tot.total), bold: true }, X.tot.reps, X.tot.aus,
        X.tot.sin ? { t: String(X.tot.sin), color: 'red', bold: true } : '0', X.tot.late, pct0(X.cumpl), fmtH(X.tot.cap + X.tot.mant), fmtH(X.tot.ag)]),
     ['Total', '', String(T.total), T.reps, T.aus, T.sin, T.late, pct0(T.asign ? T.propias / T.asign : null), fmtH(T.cap + T.mant), fmtH(T.ag)]], { totalLast: true });
  d.note('Guardias cumplidas = noches completas o parciales de su guardia más las noches que cubrió como reemplazo. Cumplimiento = noches presentes sobre noches asignadas a su guardia.');
  d.firmas(firmasJefatura());
  await d.save(`Resumen_cuerpo_activo_${ks[0]}_a_${ks[ks.length - 1]}.pdf`);
}

/* =====================================================================
   4) PARTE DE INTERVENCIÓN (interno o para fiscalía) · con croquis
   ===================================================================== */
function pdfIntervencion(viewer, x){ return generar(async () => {
  const c = sciCfg(), pt = { fecha: loc(x.creado).slice(0, 10), motivo: x.tipo, direccion: x.dir || '', ...(x.parte || {}) };
  const anio = loc(x.creado).slice(0, 4), cmd = (pt.acargo || '').trim() || (x.cmd ? nombreParte(x.cmd) : 'Sin asignar');
  const dur = (a, b) => { if(!a || !b) return ''; let m = (+b.slice(0, 2) * 60 + +b.slice(3)) - (+a.slice(0, 2) * 60 + +a.slice(3)); if(m < 0) m += 1440; return `${Math.floor(m / 60)} h ${pad(m % 60)} min`; };
  const d = await Doc.create(`Parte de intervención N° ${x.num}/${anio}`, nice(viewer));
  d.header('PARTE DE INTERVENCIÓN', `N° ${x.num}/${anio} · ${pt.motivo || x.tipo}${c.ident ? ' · ' + c.ident : ''}`, [
    ['Fecha', pt.fecha ? fechaL(pt.fecha) : ''], ['Lugar', pt.direccion || x.dir || 'Sin dirección'],
    ['A cargo del siniestro', cmd], ['Estado', x.estado === 'activo' ? 'En curso' : 'Cerrado' + (x.cerrado ? ' · ' + fmtD(loc(x.cerrado)) : '')],
    ['Aviso recibido por', [pt.medio, pt.solicitante].filter(Boolean).join(' · ') || '—'], ['Colaboraron', pt.colaboro || '—']]);
  d.kpis([[pt.aviso || '—', 'hora de aviso'], [pt.salida || '—', 'hora de salida'], [pt.arribo || '—', 'hora de arribo'], [pt.retorno || '—', 'hora de retorno'],
    [dur(pt.salida, pt.retorno) || '—', 'duración (salida a retorno)']]);
  d.section('Unidades y dotación');
  const filas = x.unidades.map(u => { const cu = c.unidades.find(z => z.n === u), crew = x.dot.filter(z => z.u === u);
    return crew.length ? crew.map((z, i) => [i ? '' : { t: u, bold: true }, i ? '' : (cu?.tipo || ''), z.n, z.f]) : [[{ t: u, bold: true }, cu?.tipo || '', { t: 'Sin dotación asignada', color: 'gray' }, '']]; }).flat();
  const sueltos = x.dot.filter(z => !x.unidades.includes(z.u)).map(z => [z.u, '', z.n, z.f]);
  d.table([{ h: 'Unidad', w: 90 }, { h: 'Tipo', w: 95 }, { h: 'Bombero' }, { h: 'Función', w: 150 }],
    [...filas, ...sueltos, ['Total', `${x.unidades.length} unidad${x.unidades.length === 1 ? '' : 'es'}`, `${x.dot.length} efectivo${x.dot.length === 1 ? '' : 's'}`, '']], { totalLast: true });
  d.section('Lo actuado');
  d.para('Descripción de lo actuado', pt.relato || x.notas || 'Sin descripción.');
  d.para('Víctimas o lesionados', pt.victimas);
  d.para('Vehículos, inmuebles o bienes involucrados', pt.involucrados);
  d.para('Daños', pt.danos);
  d.para('Recursos utilizados', pt.recursos);
  d.para('Causa probable', pt.causa);
  d.para('Observaciones', pt.obsInt);
  const ev = [...x.ev].reverse().filter(e => !/^(Datos del parte actualizados|Imagen (adjunta|quitada):)/.test(e.t));
  if(ev.length){
    d.section('Bitácora', 90);
    d.table([{ h: 'Fecha y hora', w: 74 }, { h: 'Evento' }, { h: 'Registró', w: 120 }], ev.map(e => [fmtD(loc(e.ts)), e.t, e.por ? nice(e.por) : '']), { size: 7.5, rh: 14 });
  }
  const adj = x.adj || [];
  if(adj.length){
    d.section('Croquis y fotos', 260);
    for(const j of adj){ const data = await rpc('sci_adjunto', { tok: tokNow(), aid: j.id }); if(data) await d.image(data, j.n); }
  }
  d.firmas([{ label: 'A cargo del siniestro', name: cmd }, firmasJefatura()[0]]);
  await d.save(`Parte_intervencion_${x.num}_${anio}.pdf`);
}); }

/* =====================================================================
   5) CALIFICACIÓN · acta anual (Decreto 957/04) o control semestral
   ===================================================================== */
function pdfCalificacion(viewer){ return generar(async () => {
  const anio = S.calAnio, per = S.calPer || 'anio', R = calRango(anio, per), anual = per === 'anio';
  const filas = calSujetos().map(p => { const A = calAsistencia(p.n, R), f = calFila(p.id), ap = f.ovr ?? A.pts;
    const tot = (f.voc != null && f.cap != null && f.cua != null) ? ap + f.voc + f.cap + f.cua : null; return { p, A, f, ap, tot }; });
  const cerrada = filas.some(r => r.f.estado === 'cerrada');
  const d = await Doc.create(anual ? `Acta de calificación anual ${anio}` : `Control semestral de asistencia ${anio}`, nice(viewer));
  const cfg = calCfg();
  d.header(anual ? 'ACTA DE CALIFICACIÓN ANUAL' : 'CONTROL SEMESTRAL DE ASISTENCIA', anual ? `Año ${anio}${cerrada ? '' : ' · BORRADOR'}` : `${R.label} ${anio}`, [
    ['Período', `${fechaL(R.desde)} al ${fechaL(R.hasta)}`], ['Integrantes', String(filas.length)],
    ['Metas por semestre', `${cfg.metas.ag} h asist. general · ${cfg.metas.gm} h cap./mant. de guardia`],
    ['Pesos', CAL_COMP.map(([k]) => `${{ guardias: 'Guardias', gm: 'Cap./mant.', ag: 'Asist. gral.', novedades: 'Novedades', alertas: 'Alertas', tareas: 'Tareas' }[k]} ${calPeso(cfg.pesos, k)}`).join(' · ')]]);
  if(anual){
    const cnt = c => filas.filter(r => r.tot != null && calConcepto(r.tot) === c).length;
    d.kpis([[String(cnt('Excelente')), 'Excelente (19-20)'], [String(cnt('Muy bueno')), 'Muy bueno (16-18)'], [String(cnt('Bueno')), 'Bueno (10-15)'], [String(cnt('Insuficiente')), 'Insuficiente (0-9) · observados', true]]);
    d.section('Calificación del personal');
    d.table([{ h: 'Integrante' }, { h: 'Jerarquía', w: 62 }, { h: 'Asist. %', w: 40, align: 'right' }, { h: 'Asist.', w: 34, align: 'center' },
      { h: 'Vocación', w: 44, align: 'center' }, { h: 'Capac.', w: 38, align: 'center' }, { h: 'Cualid.', w: 38, align: 'center' }, { h: 'Total', w: 34, align: 'center' }, { h: 'Concepto', w: 66 }],
      filas.map(r => { const g = gradoDe(r.p.n), c = r.tot != null ? calConcepto(r.tot) : '';
        return [r.p.n, g ? g.a : (r.p.cat === 'Aspirante' ? 'Aspirante' : 'Bombero'), Math.round(r.A.pct) + ' %', { t: String(r.ap) + (r.f.ovr != null ? '*' : ''), bold: true },
          r.f.voc ?? '—', r.f.cap ?? '—', r.f.cua ?? '—', { t: r.tot != null ? String(r.tot) : '—', bold: true },
          c ? { t: c, fill: { Excelente: 'green', 'Muy bueno': 'gsoft', Bueno: 'yellow', Insuficiente: 'red' }[c], color: c === 'Excelente' || c === 'Insuficiente' ? 'white' : 'ink', bold: true } : '']; }), { size: 7.5, rh: 14 });
    const corr = filas.filter(r => r.f.ovr != null);
    if(corr.length){ d.section('Correcciones de asistencia'); corr.forEach(r => d.para(r.p.n, `Calculada ${r.A.pts} puntos (${Math.round(r.A.pct)} %) · asignada ${r.f.ovr} puntos. Motivo: ${r.f.ovrMot || ''}`)); }
    const ofs = filas.filter(r => esOficial(r.p.n));
    if(ofs.length){ d.section('Calificación exclusiva para oficiales');
      d.table([{ h: 'Oficial' }, ...CAL_OF.map(([k, n]) => ({ h: n, w: 120 }))], ofs.map(r => [r.p.n, ...CAL_OF.map(([k]) => (r.f.of || {})[k] || '—')]), { size: 7.5 }); }
    d.note('Asistencia calculada por la app: guardias, capacitación y mantenimiento de guardia, asistencia general, convocatorias de novedades, alertas y tareas, ponderadas con los pesos indicados. Escala: 100 % = 5 · 80-99 % = 4 · 60-79 % = 3 · 40-59 % = 2 · 25-39 % = 1 · menos de 25 % = 0. * Asistencia corregida por la junta. Concepto: 19-20 Excelente, 16-18 Muy bueno, 10-15 Bueno, 0-9 Insuficiente (queda observado el período siguiente). Decreto 957/04, Ley 8058.');
    d.firmas([{ label: 'Jefe del Cuerpo Activo', name: jefatura().jefe ? nombreConGrado(jefatura().jefe.n) : '' }, { label: 'Sub Jefe del Cuerpo Activo', name: jefatura().sub ? nombreConGrado(jefatura().sub.n) : '' }, { label: 'Presidente / Comisión Directiva' }]);
  } else {
    d.section('Asistencia por parte');
    d.table([{ h: 'Integrante' }, ...CAL_COMP.map(([k, n]) => ({ h: n.replace('Capacitación y mantenimiento de guardia', 'Cap./mant. guardia').replace('Novedades con asistencia', 'Novedades'), w: 50, align: 'right' })), { h: 'Total', w: 40, align: 'right' }, { h: 'Puntos', w: 38, align: 'center' }],
      filas.map(r => [r.p.n, ...CAL_COMP.map(([k]) => { const x = r.A.comps[k]; return x ? { t: Math.round(x.pct) + ' %', color: x.pct < 60 ? 'red' : 'ink', bold: x.pct < 60 } : { t: '—', color: 'gray' }; }),
        { t: Math.round(r.A.pct) + ' %', bold: true }, { t: String(r.A.pts), bold: true }]), { size: 7.5, rh: 14 });
    d.note('Control de mitad de año: solo la asistencia. En rojo, las partes por debajo del 60 %. Las horas se miden contra la meta del semestre.');
    d.firmas(firmasJefatura());
  }
  await d.save(anual ? `Acta_calificacion_${anio}.pdf` : `Control_semestral_${per}_${anio}.pdf`);
}); }

/* =====================================================================
   6) LEGAJO · foja de servicios (sin datos personales ni médicos)
   ===================================================================== */
function pdfFoja(viewer, D){ return generar(async () => {
  const L = D.leg || {}, p = S.roster.find(r => r.id === D.id) || { n: D.n, cat: 'Bombero', g: 0 }, g = gradoDe(D.n), nv = nivelDe(L.niv), an = aniosDesde(L.efe);
  const d = await Doc.create(`Foja de servicios · ${D.n}`, nice(viewer));
  d.header('FOJA DE SERVICIOS', nombreConGrado(D.n), [
    ['Legajo N°', L.num || '—'], ['Ubicación', ubicTxt(p) + ' · ' + p.cat],
    ['Ingreso como aspirante', L.asp ? fechaL(L.asp) : '—'], ['Bombero efectivo', L.efe ? `${fechaL(L.efe)} · ${an} año${an === 1 ? '' : 's'} de antigüedad` : '—'],
    ['Nivel de capacitación', nv ? nv.n + (L.nivDesde ? ` (desde ${fechaL(L.nivDesde)})` : '') : '—'], ['Jerarquía', g ? g.n + (L.jerDesde ? ` (desde ${fechaL(L.jerDesde)})` : '') : 'Sin grado']]);
  d.section('Departamentos');
  if(D.deps.length) d.table([{ h: 'Departamento' }, { h: 'Desde', w: 90 }, { h: 'Función', w: 110 }],
    D.deps.map(x => { const dp = deptoDe(x.id); return [dp ? dp.n : '', x.desde ? fechaL(x.desde) : '—', x.resp ? 'Responsable' : 'Integrante']; }));
  else d.note('Sin departamentos asignados.');
  d.section('Cursos y certificados', 60);
  const hoy = dstr(new Date());
  if(D.cursos.length) d.table([{ h: 'Curso' }, { h: 'Institución', w: 150 }, { h: 'Fecha', w: 62 }, { h: 'Vence', w: 80 }],
    D.cursos.map(c => [c.t, c.inst || '', c.f ? mmaa(c.f) : '—', c.v ? { t: mmaa(c.v) + (c.v < hoy ? ' · vencido' : ''), color: c.v < hoy ? 'red' : 'ink', bold: c.v < hoy } : '—']), { size: 8 });
  else d.note('Sin cursos cargados.');
  d.section('Ascensos, niveles y menciones', 60);
  if(D.hist.length) d.table([{ h: 'Fecha', w: 70 }, { h: 'Tipo', w: 120 }, { h: 'Detalle' }], D.hist.map(h => [fechaL(h.f), LEG_TIPOS[h.tipo] || '', h.t]), { size: 8 });
  else d.note('Sin registros.');
  d.section('Calificaciones anuales (Decreto 957/04)', 60);
  if(D.calif.length) d.table([{ h: 'Año', w: 70 }, { h: 'Puntaje', w: 80, align: 'center' }, { h: 'Concepto' }], D.calif.map(c => [String(c.anio), `${c.total ?? '—'} / 20`, c.concepto || '']), { size: 8 });
  else d.note('Sin calificaciones cerradas.');
  d.note('Emitido desde el legajo digital del cuartel. No incluye datos personales ni médicos (Ley 25.326).');
  d.firmas(firmasJefatura());
  await d.save(`Foja_servicios_${split(D.n)[0].replace(/\s+/g, '_')}.pdf`);
}); }

/* =====================================================================
   7) LEGAJO · formulario de consentimiento (Ley 25.326) para imprimir y firmar
   ===================================================================== */
function pdfConsentimiento(viewer, nombre){ return generar(async () => {
  const p = nombre ? member(nombre) : null;
  const d = await Doc.create('Consentimiento · datos personales y de salud', nice(viewer));
  d.header('CONSENTIMIENTO INFORMADO', 'Tratamiento de datos personales y de salud · Ley 25.326', [
    ['Apellido y nombre', nombre || ''], ['DNI', ''], ['Categoría', p ? (p.cat === 'Aspirante' ? 'Aspirante' : 'Bombero') : ''], ['Teléfono', '']]);
  const txt = (t, o = {}) => { for(const ln of d.wrap(t, o.size || 8.6, d.R - d.L - (o.ind || 0), o.bold)){ d.ensure(12); d.y -= 11; d.text(ln, d.L + (o.ind || 0), d.y, { size: o.size || 8.6, bold: o.bold }); } };
  const tit = t => { d.ensure(30); d.y -= 8; txt(t.toUpperCase(), { size: 8, bold: true }); };
  tit('1. Responsable');
  txt('La Asociación Bomberos Voluntarios de Isla Verde es la responsable de la base de datos. Domicilio: Líbano 342, Isla Verde, Córdoba. Teléfono: 03468-496333. Los datos se guardan en el sistema del cuartel, con acceso por PIN personal y registro de cada consulta.');
  tit('2. Para qué se usan');
  txt('Llevar el legajo (ingreso, jerarquía, nivel, departamentos, cursos, calificaciones y antigüedad); gestionar guardias, asistencia, equipamiento y reemplazos; contar con información de salud para una atención rápida ante un accidente durante un servicio; controlar el apto físico; y cumplir informes que pidan la Federación o los organismos provinciales. No se usan con fines comerciales, no se venden ni se publican.');
  tit('3. Qué datos');
  txt('Personales: DNI, fecha de nacimiento, domicilio, teléfono, correo, obra social y contacto de emergencia. De salud (datos sensibles, arts. 2 y 7): grupo y factor sanguíneo, alergias, condiciones a tener en cuenta, medicación habitual, vacunas, apto físico y ficha médica. Nadie está obligado a dar datos sensibles.');
  tit('4. Quién los ve');
  txt('Legajo institucional: la persona, la jefatura, los superiores y el administrador del sistema. Datos personales y de salud: la persona, el Jefe, el Sub Jefe, el administrador del sistema y, durante un siniestro, quien esté a cargo del operativo. Cada consulta queda registrada y la persona puede verla. Quienes acceden tienen deber de confidencialidad (art. 10).');
  tit('5. Conservación y derechos');
  txt('Los datos se conservan mientras la persona integre el cuerpo y hasta 3 años después de su baja o retiro; después se borran. Los datos de salud se borran antes si retira este consentimiento. La persona puede pedir acceso (respuesta en 10 días corridos), rectificación (5 días hábiles) y supresión, y retirar este consentimiento en cualquier momento por escrito ante la Jefatura, sin consecuencias para su condición de bombero. Firmar es voluntario.');
  d.ensure(40); d.y -= 6;
  txt('El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.', { size: 7.4 });
  tit('6. Autorizo (marcar con una cruz)');
  for(const t of ['El tratamiento de mis datos personales para el legajo y la gestión del cuartel.', 'El tratamiento de mis datos de salud con las finalidades y accesos indicados.',
    'Que en una emergencia se informen mis datos de salud imprescindibles al servicio que me atienda.']){
    d.ensure(16); d.y -= 15; d.rect(d.L, d.y - 2, 10, 10, null, 'ink'); d.text(t, d.L + 16, d.y, { size: 8.6 });
  }
  d.y -= 4; txt('Me comprometo a avisar cualquier cambio en mis datos de salud. Lugar y fecha: Isla Verde, ____ / ____ / ________');
  d.firmas([{ label: 'Firma del bombero/a' }, { label: 'Recibió (Jefatura)' }]);
  if(!p || p.cat === 'Aspirante'){
    tit('Aspirantes menores de 18 años');
    txt('Firma también su madre, padre o tutor. El aspirante deja constancia de que fue informado.');
    d.firmas([{ label: 'Madre / padre / tutor', sub: 'Firma · DNI · vínculo' }, { label: 'Aspirante menor', sub: 'Firma' }]);
  }
  d.note('Se firman dos ejemplares: uno para el legajo y otro para el firmante. Modelo para revisar con el asesor legal de la Asociación.');
  await d.save(nombre ? `Consentimiento_${split(nombre)[0].replace(/\s+/g, '_')}.pdf` : 'Consentimiento_datos_personales.pdf');
}); }
