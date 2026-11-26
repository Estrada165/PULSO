const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function el(tag, attrs = {}, padre) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (padre) padre.appendChild(e);
  return e;
}

export function escalaBonita(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * p;
}

let tip;
function tooltip() {
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
  return tip;
}
export function mostrarTip(ancla, x, y, html) {
  const t = tooltip();
  t.innerHTML = html; t.classList.add('ver');
  const r = ancla.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
  const vw = document.documentElement.clientWidth;
  let left = r.left + x + 16, top = r.top + y - th / 2;
  if (left + tw > vw - 10) left = r.left + x - tw - 16;
  left = Math.max(10, left);
  top = Math.max(70, Math.min(top, window.innerHeight - th - 10));
  t.style.transform = `translate(${left}px, ${top}px)`;
}
export function ocultarTip() { tooltip().classList.remove('ver'); }

export function filaTip(color, nombre, valor) {
  return `<div class="tip-f"><span><i style="background:${color}"></i>${nombre}</span><b>${valor}</b></div>`;
}

export function grafico(cont, o) {
  cont.innerHTML = '';
  cont.classList.add('grafico');
  const W = Math.max(260, cont.clientWidth), H = o.alto || 260;
  const m = { l: o.ml ?? 40, r: o.mr ?? 8, t: o.mt ?? 14, b: o.mb ?? 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.n, sw = iw / n;
  const ymin = o.ymin ?? 0;
  let ymax = o.ymax;
  if (ymax == null) {
    let mx = -Infinity;
    for (const s of o.series) for (const v of (s.hi || s.valores || [])) if (v != null && v > mx) mx = v;
    for (const r of (o.refs || [])) mx = Math.max(mx, r.y);
    ymax = escalaBonita((mx - ymin) * 1.06) + ymin;
  }
  const X = (i) => m.l + (i + 0.5) * sw;
  const Y = (v) => m.t + ih - ((v - ymin) / (ymax - ymin)) * ih;
  const animar = o.animar !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || '', class: animar ? 'anim' : '' }, cont);
  const defs = el('defs', {}, svg);

  const nt = o.ticks ?? 4;
  const gRej = el('g', { class: 'rejilla' }, svg);
  for (let k = 0; k <= nt; k++) {
    const v = ymin + (ymax - ymin) * k / nt, y = Y(v);
    el('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: v === 0 ? 'base' : '' }, gRej);
    const t = el('text', { x: m.l - 10, y: y + 3.5, 'text-anchor': 'end', class: 'eje' }, svg);
    t.textContent = (o.yfmt || ((v) => Math.round(v).toLocaleString('es-PE')))(v);
  }
  for (const xt of (o.xticks || [])) {
    const t = el('text', { x: m.l + xt.i * sw, y: H - 7, 'text-anchor': xt.anchor || 'middle', class: 'eje' }, svg);
    t.textContent = xt.lbl;
  }

  for (const mk of (o.marcas || [])) {
    const x0 = m.l + mk.i0 * sw, w = (mk.i1 - mk.i0) * sw;
    const id = 'rayas' + (++uid);
    const pat = el('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: css('--alerta'), 'stroke-width': 1.4, opacity: 0.35 }, pat);
    el('rect', { x: x0, y: m.t, width: w, height: ih, fill: `url(#${id})`, rx: 4 }, svg);
    el('rect', { x: x0, y: m.t, width: w, height: ih, fill: css('--alerta'), opacity: 0.05, rx: 4 }, svg);
    if (mk.lbl) { const t = el('text', { x: x0 + 6, y: m.t + 12, class: 'eje marca-txt' }, svg); t.textContent = mk.lbl; }
  }

  const col = el('rect', { y: m.t, height: ih, width: sw, rx: 3, class: 'col-hover', opacity: 0 }, svg);

  const barras = o.series.filter((s) => s.tipo === 'barra');
  const gap = barras.length > 1 ? Math.min(5, sw * 0.1) : 0;
  const anchoUtil = sw * (o.anchoBarra ?? 0.76);
  const bw = Math.max(1, (anchoUtil - gap * (barras.length - 1)) / Math.max(1, barras.length));
  const puntos = [];

  o.series.forEach((s, si) => {
    const g = el('g', { class: 'serie', style: `--d:${si * 90}ms` }, svg);
    if (s.tipo === 'banda') {
      let d = '';
      s.hi.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i) + ',' + Y(v); });
      for (let i = s.lo.length - 1; i >= 0; i--) d += 'L' + X(i) + ',' + Y(s.lo[i]);
      el('path', { d: d + 'Z', fill: s.color, opacity: 0.14, class: 'banda' }, g);
    } else if (s.tipo === 'barra') {
      const bi = barras.indexOf(s);
      const y0 = Y(Math.max(ymin, 0));
      s.valores.forEach((v, i) => {
        if (v == null || v === 0 || (ymin >= 0 && v < 0)) return;
        const x0 = m.l + i * sw + (sw - (bw * barras.length + gap * (barras.length - 1))) / 2 + bi * (bw + gap);
        const y1 = Y(v), h = Math.max(1, Math.abs(y0 - y1)), r = Math.min(3.5, bw / 2, h);
        const arriba = v > 0;
        const top = arriba ? y0 - h : y0 + h;
        const d = arriba
          ? `M${x0},${y0}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${y0}Z`
          : `M${x0},${y0}V${top - r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top - r}V${y0}Z`;
        el('path', { d, fill: s.color, opacity: s.opacidad ?? 1, class: 'barra' + (arriba ? '' : ' neg'), style: animar ? `animation-delay:${Math.min(400, i * (400 / n))}ms` : '' }, g);
      });
    } else {
      let d = '', mov = true, primero = null, ultimo = null;
      s.valores.forEach((v, i) => {
        if (v == null) { mov = true; return; }
        if (s.tipo === 'escalon') {
          const x0 = m.l + i * sw, x1 = x0 + sw;
          d += (mov ? 'M' : 'L') + x0 + ',' + Y(v) + 'L' + x1 + ',' + Y(v);
          primero ??= x0; ultimo = x1;
        } else {
          d += (mov ? 'M' : 'L') + X(i) + ',' + Y(v);
          primero ??= X(i); ultimo = X(i);
        }
        mov = false;
      });
      if (s.area && d) {
        const id = 'deg' + (++uid);
        const lg = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': 0.28 }, lg);
        el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0 }, lg);
        el('path', { d: `${d}L${ultimo},${m.t + ih}L${primero},${m.t + ih}Z`, fill: `url(#${id})`, class: 'area' }, g);
      }
      el('path', {
        d, fill: 'none', stroke: s.color, 'stroke-width': s.grosor || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': s.punteada ? '4 5' : null, pathLength: s.punteada ? null : 1, class: s.punteada ? 'linea punteada' : 'linea',
      }, g);
      if (!s.sinPunto) puntos.push({ s, c: el('circle', { r: 4.2, fill: s.color, stroke: css('--surface'), 'stroke-width': 2.2, opacity: 0, class: 'punto' }, svg) });
    }
  });

  for (const r of (o.refs || [])) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), class: 'ref' }, svg);
    if (r.lbl) {
      const t = el('text', { x: W - m.r - 2, y: Y(r.y) - 6, 'text-anchor': 'end', class: 'eje ref-txt' }, svg);
      t.textContent = r.lbl;
    }
  }

  if (o.cursor != null) {
    const x = m.l + o.cursor * sw;
    el('line', { x1: x, x2: x, y1: m.t - 4, y2: m.t + ih, class: 'cursor-fijo' }, svg);
  }

  const guia = el('line', { y1: m.t, y2: m.t + ih, class: 'guia', opacity: 0 }, svg);
  const capa = el('rect', { x: m.l, y: 0, width: iw, height: H, fill: 'transparent' }, svg);
  let ultimoI = -1;
  const mover = (ev) => {
    const r = svg.getBoundingClientRect(), mx = ev.clientX - r.left;
    const i = Math.min(n - 1, Math.max(0, Math.floor((mx - m.l) / sw)));
    if (i !== ultimoI) {
      ultimoI = i;
      guia.setAttribute('x1', X(i)); guia.setAttribute('x2', X(i)); guia.setAttribute('opacity', 1);
      col.setAttribute('x', m.l + i * sw); col.setAttribute('opacity', 1);
      for (const p of puntos) {
        const v = p.s.valores[i];
        if (v == null) { p.c.setAttribute('opacity', 0); continue; }
        p.c.setAttribute('cx', X(i)); p.c.setAttribute('cy', Y(v)); p.c.setAttribute('opacity', 1);
      }
    }
    const filas = o.series.filter((s) => !s.sinTip).map((s) => {
      const v = s.tipo === 'banda'
        ? `${Math.round(s.lo[i]).toLocaleString('es-PE')} – ${Math.round(s.hi[i]).toLocaleString('es-PE')}`
        : (s.valores[i] == null ? '—' : (s.vfmt || o.vfmt || ((v) => Math.round(v).toLocaleString('es-PE')))(s.valores[i]));
      return filaTip(s.color, s.nom, v);
    }).join('');
    mostrarTip(svg, X(i), ev.clientY - r.top, `<div class="tip-t">${o.xlbl(i)}</div>${filas}${o.extraTip ? o.extraTip(i) : ''}`);
  };
  capa.addEventListener('pointermove', mover);
  capa.addEventListener('pointerdown', mover);
  capa.addEventListener('pointerleave', () => {
    ultimoI = -1; guia.setAttribute('opacity', 0); col.setAttribute('opacity', 0);
    for (const p of puntos) p.c.setAttribute('opacity', 0);
    ocultarTip();
  });
  return { svg, X, Y, m, sw, ih, iw, W, H };
}

export function leyenda(items) {
  return `<div class="leyenda">${items.map((it) => `<span class="ley ${it.forma || 'linea'}"><i style="--c:${it.color}"></i>${it.nom}</span>`).join('')}</div>`;
}
