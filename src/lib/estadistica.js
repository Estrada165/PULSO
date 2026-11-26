function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betai(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const pT = (t, gl) => betai(gl / 2, 0.5, gl / (gl + t * t));
export function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export const desv = (a) => { const m = media(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

export function pruebaTPareada(a, b) {
  const d = a.map((x, i) => b[i] - x);
  const n = d.length, md = media(d), sd = desv(d);
  const t = sd > 0 ? md / (sd / Math.sqrt(n)) : (md === 0 ? 0 : Infinity * Math.sign(md));
  const gl = n - 1;
  const p = Number.isFinite(t) ? pT(t, gl) : 0;
  const tc = 2.045;
  return { n, gl, t, p, dif: md, ic: [md - tc * sd / Math.sqrt(n), md + tc * sd / Math.sqrt(n)], d: sd > 0 ? md / sd : 0 };
}

export function wilcoxon(a, b) {
  const d = a.map((x, i) => b[i] - x).filter((x) => Math.abs(x) > 1e-12);
  const n = d.length;
  const orden = d.map((x, i) => [Math.abs(x), i]).sort((p, q) => p[0] - q[0]);
  const rango = new Array(n);
  let empates = 0;
  for (let i = 0; i < n;) {
    let j = i; while (j + 1 < n && orden[j + 1][0] === orden[i][0]) j++;
    const r = (i + j) / 2 + 1, t = j - i + 1;
    for (let k = i; k <= j; k++) rango[orden[k][1]] = r;
    empates += t ** 3 - t;
    i = j + 1;
  }
  let wPos = 0; d.forEach((x, i) => { if (x > 0) wPos += rango[i]; });
  const mu = n * (n + 1) / 4;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - empates / 48);
  const z = sigma > 0 ? (wPos - mu) / sigma : 0;
  return { n, W: wPos, z, p: 2 * (1 - phi(Math.abs(z))), r: Math.abs(z) / Math.sqrt(n) };
}

export function generador(semilla) {
  let s = semilla >>> 0;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = () => { let a = 0; while (a === 0) a = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u()); };
  const poisson = (l) => {
    if (l <= 0) return 0;
    if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * normal()));
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= u(); } while (p > L);
    return k - 1;
  };
  return { u, normal, poisson };
}

export const textoP = (p) => (p < 0.001 ? 'p < 0.001' : 'p = ' + p.toFixed(3));
