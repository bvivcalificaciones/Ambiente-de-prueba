/* =====================================================================
   JERARQUÍAS · escalafón bomberil de la Provincia de Córdoba
   Cada grado tiene nombre, abreviatura e insignia (dibujada en SVG, se ve nítida en cualquier tamaño).
   Si en el cuartel usan otra abreviatura, se cambia acá.
   ===================================================================== */
const GRADOS = [
  // Sub oficiales sub alternos
  { k: 'cabo',          n: 'Cabo',                  a: 'Cbo.',          g: 'Sub oficiales sub alternos' },
  { k: 'cabo1',         n: 'Cabo 1º',               a: 'Cbo. 1º',       g: 'Sub oficiales sub alternos' },
  { k: 'sargento',      n: 'Sargento',              a: 'Sgto.',         g: 'Sub oficiales sub alternos' },
  // Sub oficiales superiores
  { k: 'sargento1',     n: 'Sargento 1º',           a: 'Sgto. 1º',      g: 'Sub oficiales superiores' },
  { k: 'sargento_ayte', n: 'Sargento Ayudante',     a: 'Sgto. Ayte.',   g: 'Sub oficiales superiores' },
  { k: 'subof_ppal',    n: 'Sub Oficial Principal', a: 'Sub Of. Ppal.', g: 'Sub oficiales superiores' },
  { k: 'subof_mayor',   n: 'Sub Oficial Mayor',     a: 'Sub Of. My.',   g: 'Sub oficiales superiores' },
  // Oficiales sub alternos
  { k: 'of_ayte',       n: 'Oficial Ayudante',      a: 'Of. Ayte.',     g: 'Oficiales sub alternos' },
  { k: 'of_subinsp',    n: 'Oficial Sub Inspector', a: 'Of. Sub Insp.', g: 'Oficiales sub alternos' },
  { k: 'of_insp',       n: 'Oficial Inspector',     a: 'Of. Insp.',     g: 'Oficiales sub alternos' },
  { k: 'of_ppal',       n: 'Oficial Principal',     a: 'Of. Ppal.',     g: 'Oficiales sub alternos' },
  // Oficiales jefes
  { k: 'subcrio',       n: 'Sub Comisario',         a: 'Sub Crio.',     g: 'Oficiales jefes' },
  { k: 'crio',          n: 'Comisario',             a: 'Crio.',         g: 'Oficiales jefes' },
  // Oficiales superiores
  { k: 'crio_insp',     n: 'Comisario Inspector',   a: 'Crio. Insp.',   g: 'Oficiales superiores' },
  { k: 'crio_mayor',    n: 'Comisario Mayor',       a: 'Crio. My.',     g: 'Oficiales superiores' },
  { k: 'crio_gral',     n: 'Comisario General',     a: 'Crio. Gral.',   g: 'Oficiales superiores' }
];
const GRADO = Object.fromEntries(GRADOS.map(x => [x.k, x]));
const gradoDe = n => GRADO[(S.jer || {})[n]] || null;

/* ---------- insignias ---------- */
const INS_C = { rojo: '#e3101b', oro: '#d6a915', oroClaro: '#f7dc6f', plata: '#c9ced3', plataClaro: '#f4f6f8', negro: '#151515' };
function insRombo(cx, cy, r, oro){
  const c1 = oro ? INS_C.oroClaro : INS_C.plataClaro, c2 = oro ? INS_C.oro : INS_C.plata;
  const rayos = [...Array(12)].map((_, i) => { const a = i * Math.PI / 6; return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * r * 0.7).toFixed(1)}" y2="${(cy + Math.sin(a) * r * 0.7).toFixed(1)}" stroke="${c2}" stroke-width="1"/>`; }).join('');
  return `<path d="M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z" fill="${c1}" stroke="${c2}" stroke-width="2"/>${rayos}<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="none" stroke="${c2}" stroke-width="1.6"/>`;
}
function insFeston(x0, x1, y, h){
  const n = Math.max(3, Math.round((x1 - x0) / 14)), w = (x1 - x0) / n;
  let d = `M${x0} ${y + h}L${x0} ${y + h * 0.45}`;
  for(let i = 0; i < n; i++) d += `A${w / 2} ${h * 0.45} 0 0 1 ${(x0 + w * (i + 1)).toFixed(1)} ${y + h * 0.45}`;
  return `<path d="${d}L${x1} ${y + h}Z" fill="${INS_C.oro}"/>`;
}
function insLaurel(cy){
  const hojas = s => [0, 1, 2, 3, 4].map(i => { const x = 60 + s * (12 + i * 9), y = cy + (i % 2 ? -3 : 3);
    return `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.2" transform="rotate(${s * (i % 2 ? -25 : 25)} ${x} ${y})" fill="${INS_C.oro}"/>`; }).join('');
  return `<path d="M60 ${cy + 2}c-6-10 6-10 0 0z" fill="none" stroke="${INS_C.oro}" stroke-width="2.4"/><rect x="18" y="${cy - 0.8}" width="84" height="1.8" fill="${INS_C.oro}"/>${hojas(-1)}${hojas(1)}`;
}
function insigniaSvg(k, alto = 26, titulo = true){
  const g = GRADO[k]; if(!g) return '';
  const R = INS_C, galon = ['cabo', 'cabo1', 'sargento'].includes(k);
  let body;
  if(galon){
    // galón en V
    const lineas = { cabo: [0.5], cabo1: [0.28, 0.5], sargento: [0.22, 0.62] }[k];
    const banda = (t, gr, col) => { const y1 = 26 + t * 22; return `<path d="M14 ${y1}L60 ${y1 + 22}L106 ${y1}" fill="none" stroke="${col}" stroke-width="${gr}" stroke-linejoin="miter"/>`; };
    body = `<path d="M2 2H118V52L60 82L2 52Z" fill="${R.rojo}"/><path d="M14 24L60 46L106 24V44L60 66L14 44Z" fill="${R.oro}"/>${lineas.map(t => banda(t * 0.95, 3.4, R.negro)).join('')}`;
  } else {
    let x = `<rect x="2" y="2" width="116" height="76" fill="${R.rojo}"/>`;
    if(k === 'sargento1') x += `<rect x="2" y="40" width="116" height="34" fill="${R.oro}"/><rect x="2" y="47" width="116" height="7" fill="${R.negro}"/>`;
    if(k === 'sargento_ayte') x += `<rect x="2" y="14" width="116" height="60" fill="${R.oro}"/><rect x="2" y="22" width="116" height="7" fill="${R.negro}"/><rect x="2" y="37" width="116" height="7" fill="${R.negro}"/>`;
    if(k === 'subof_ppal') x += `<rect x="2" y="28" width="116" height="24" fill="${R.oro}"/>`;
    if(k === 'subof_mayor') x += [28, 60, 92].map(c => `<ellipse cx="${c}" cy="40" rx="18" ry="10" fill="none" stroke="${R.oro}" stroke-width="4"/>`).join('');
    const rombos = { of_ayte: [[60, 0]], of_subinsp: [[40, 1], [80, 0]], of_insp: [[40, 0], [80, 0]], of_ppal: [[24, 0], [60, 0], [96, 0]],
      subcrio: [[60, 1]], crio: [[40, 1], [80, 1]], crio_insp: [[60, 1]], crio_mayor: [[40, 1], [80, 1]], crio_gral: [[24, 1], [60, 1], [96, 1]] }[k];
    const sup = ['crio_insp', 'crio_mayor', 'crio_gral'].includes(k), jefe = ['subcrio', 'crio'].includes(k);
    if(rombos) x += rombos.map(([c, o]) => insRombo(c, sup ? 22 : jefe ? 28 : 40, sup ? 14 : jefe ? 16 : 17, !!o)).join('');
    if(sup) x += insLaurel(46);
    if(jefe || sup) x += k === 'subcrio' ? insFeston(30, 90, 56, 20) : insFeston(6, 114, 56, 20);
    body = x;
  }
  const h = galon ? 84 : 80;
  return `<svg class="insignia" viewBox="0 0 120 ${h}" height="${alto}" width="${Math.round(alto * 120 / h)}" role="img" aria-label="${g.n}">${titulo ? `<title>${g.n}</title>` : ''}${body}</svg>`;
}
const insigniaDe = (n, alto) => { const g = gradoDe(n); return g ? insigniaSvg(g.k, alto) : ''; };
// "Sgto. B.V. Alchapar Diego" (parte de prensa, firmas). Aspirantes: "Asp."; sin grado: "B.V."
function nombreConGrado(n){
  const p = member(n), g = gradoDe(n), [ln, fn] = split(n);
  const ape = ln.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const pre = p && p.cat === 'Aspirante' ? 'Asp.' : `${g ? g.a + ' ' : ''}B.V.`;
  return `${pre} ${ape} ${fn}`.trim();
}
// Opciones agrupadas por escalafón para el selector de Personal.
function gradoOptions(sel){
  const grupos = [...new Set(GRADOS.map(x => x.g))];
  return `<option value="">Sin grado</option>` + grupos.map(gr => `<optgroup label="${gr}">${GRADOS.filter(x => x.g === gr).map(x => `<option value="${x.k}" ${x.k === sel ? 'selected' : ''}>${x.n}</option>`).join('')}</optgroup>`).join('');
}
