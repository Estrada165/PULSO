import { ZONA_HORARIA } from '../config.js';
import { DIAS, MESES, MESES_CORTOS } from './formato.js';

const DIA_MS = 864e5;
const aUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const aISO = (ms) => new Date(ms).toISOString().slice(0, 10);

export function ahoraLocal() {
  if (!ZONA_HORARIA) {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { iso, minutos: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000 };
  }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, minutos: +p.hour * 60 + +p.minute + +p.second / 60 };
}

export function crearCalendario(D) {
  const base = aUTC(D.semana_inicio);
  const hoy = ahoraLocal();
  const hoyMs = aUTC(hoy.iso);
  const diaSemana = (new Date(hoyMs).getUTCDay() + 6) % 7;
  const lunesHoy = hoyMs - diaSemana * DIA_MS;
  const desfase = Math.round((lunesHoy - base) / DIA_MS);

  const visible = (iso) => aISO(aUTC(iso) + desfase * DIA_MS);
  const partes = (iso) => { const d = new Date(aUTC(visible(iso))); return { dia: d.getUTCDate(), mes: d.getUTCMonth(), anio: d.getUTCFullYear(), dow: (d.getUTCDay() + 6) % 7 }; };

  return {
    desfase,
    ajustada: desfase !== 0,
    indiceHoy: diaSemana,
    visible,
    partes,
    largo(iso) { const p = partes(iso); return `${DIAS[p.dow]} ${p.dia} de ${MESES[p.mes]}`; },
    corto(iso) { const p = partes(iso); return `${p.dia} ${MESES_CORTOS[p.mes]}`; },
    rangoSemana() {
      const a = partes(D.semana[0].fecha), b = partes(D.semana[6].fecha);
      return a.mes === b.mes ? `${a.dia} – ${b.dia} de ${MESES[b.mes]} ${b.anio}` : `${a.dia} ${MESES_CORTOS[a.mes]} – ${b.dia} ${MESES_CORTOS[b.mes]} ${b.anio}`;
    },
    feriado(iso) { return desfase === 0 ? D.feriados[iso] : (D.feriados[iso] ? 'Feriado' : null); },
    ahora: () => ahoraLocal().minutos,
    ahoraISO: () => ahoraLocal().iso,
  };
}
