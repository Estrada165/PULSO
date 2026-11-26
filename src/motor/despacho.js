export function crearMotor(D) {
  const I = D.operacion.min_intervalo;
  const INI = D.operacion.hora_inicio * 60;
  const FIN = D.operacion.hora_fin * 60;
  const KM_VIAJE = D.ruta.km_ida * 2;

  function ciclo(m) {
    const h = m / 60;
    for (const [a, b, t] of D.ciclo) if (h >= a && h < b) return t;
    return D.ciclo[D.ciclo.length - 1][2];
  }
  function disponibles(sal, m, flota) {
    let enRuta = 0;
    for (const s of sal) if (s > m - ciclo(s)) enRuta++;
    return Math.max(0, flota - enRuta);
  }
  function proximoRetorno(sal, m) {
    let r = Infinity;
    for (const s of sal) { const v = s + ciclo(s); if (v > m && v < r) r = v; }
    return r;
  }
  const red2 = (x) => Math.round(x * 100) / 100;

  function heuristica(pron, real, p, conCorreccion = true) {
    const sal = [], traza = [];
    let t = INI, factor = 1, cerrado = -1;
    while (t < FIN) {
      const k = Math.floor((t - INI) / I);
      while (conCorreccion && real && cerrado < k - 1) {
        cerrado++;
        if (pron[cerrado] > 1) {
          const r = real[cerrado] / pron[cerrado];
          if (Math.abs(r - 1) > p.umbral_correccion) factor = p.alpha_correccion * r + (1 - p.alpha_correccion) * factor;
          else factor = 0.5 * factor + 0.5;
          factor = Math.min(Math.max(factor, p.correccion_min), p.correccion_max);
        }
      }
      const Dd = pron[k] * factor;
      const tasa = Dd * p.factor_seguridad / I;
      let h = tasa > 0 ? p.capacidad * p.ocupacion_objetivo / tasa : 1e9;
      let regla = 'capacidad';
      if (h > p.espera_maxima) { h = p.espera_maxima; regla = 'espera_maxima'; }
      if (h < p.intervalo_minimo) { h = p.intervalo_minimo; regla = 'anden'; }
      if (disponibles(sal, t, p.flota) === 0) {
        t = proximoRetorno(sal, t);
        if (traza.length) traza[traza.length - 1].regla = 'flota';
        continue;
      }
      sal.push(red2(t));
      traza.push({ t: red2(t), intervalo: red2(h), demanda: Math.round(Dd * 10) / 10, regla, factor: Math.round(factor * 1000) / 1000 });
      t += h;
    }
    return { salidas: sal, traza };
  }

  function manual(tipo, flota) {
    const sal = [];
    for (const [a, b, h] of D.tabla_manual[tipo]) {
      let t = a * 60;
      while (t < b * 60) { if (disponibles(sal, t, flota) > 0) sal.push(t); t += h; }
    }
    return sal;
  }

  function simular(salidasIn, real, p) {
    const sal = [...salidasIn].sort((a, b) => a - b);
    const cola = [];
    let head = 0, espera = 0, atendidos = 0, maxE = 0, larga = 0, j = 0, qTot = 0;
    const viajes = [], colaMin = [];
    for (let m = INI; m < FIN; m++) {
      const k = Math.floor((m - INI) / I);
      cola.push([m + 0.5, real[k] / I]);
      qTot += real[k] / I;
      while (j < sal.length && sal[j] < m + 1) {
        const ts = sal[j];
        let cupo = p.capacidad, abordo = 0;
        while (head < cola.length && cupo > 1e-9 && cola[head][0] <= ts + 1e-9) {
          const c = cola[head];
          const tom = Math.min(cupo, c[1]);
          const w = ts - c[0];
          espera += tom * w;
          if (w > maxE) maxE = w;
          if (w > p.espera_maxima) larga += tom;
          cupo -= tom; abordo += tom; c[1] -= tom; qTot -= tom;
          if (c[1] <= 1e-9) head++;
        }
        atendidos += abordo;
        viajes.push(abordo / p.capacidad);
        j++;
      }
      colaMin.push(Math.max(0, qTot));
    }
    let pend = 0; for (let x = head; x < cola.length; x++) pend += cola[x][1];
    const n = viajes.length;
    const vacios = viajes.filter((o) => o < p.ocupacion_minima).length;
    const km = n * KM_VIAJE;
    const c = D.costos;
    return {
      salidas: n, km, km_vacio: vacios * KM_VIAJE,
      ocupacion_prom: n ? viajes.reduce((a, b) => a + b, 0) / n : 0,
      espera_prom: atendidos ? espera / atendidos : 0,
      espera_max: maxE, atendidos, no_atendidos: pend,
      pct_espera_larga: atendidos ? 100 * larga / atendidos : 0,
      litros: km * c.consumo_l_km, costo: km * c.consumo_l_km * c.precio_l, co2_kg: km * c.consumo_l_km * c.co2_kg_l,
      ocupaciones: viajes, cola_min: colaMin, horas: sal,
    };
  }

  function demandaReal(i, escenario) {
    const real = D.semana[i].real.map(Number);
    if (!escenario || !escenario.activo || escenario.dia !== i) return real;
    return real.map((v, k) => {
      const m = INI + k * I + I / 2;
      return (m >= escenario.inicio && m < escenario.inicio + escenario.duracion) ? Math.round(v * (1 + escenario.intensidad)) : v;
    });
  }

  function semana(p, opciones = {}) {
    const conCorreccion = opciones.correccion !== false;
    const dias = D.semana.map((d, i) => {
      const real = demandaReal(i, opciones.escenario);
      const sm = manual(d.tipo, p.flota);
      const hi = heuristica(d.prophet, real, p, conCorreccion);
      return { fecha: d.fecha, tipo: d.tipo, real, manual: simular(sm, real, p), inteligente: simular(hi.salidas, real, p), traza: hi.traza };
    });
    const total = {};
    for (const e of ['manual', 'inteligente']) {
      const r = dias.map((d) => d[e]);
      const at = r.reduce((a, x) => a + x.atendidos, 0);
      const sal = r.reduce((a, x) => a + x.salidas, 0);
      total[e] = {
        salidas: sal,
        km: r.reduce((a, x) => a + x.km, 0),
        km_vacio: r.reduce((a, x) => a + x.km_vacio, 0),
        ocupacion_prom: r.reduce((a, x) => a + x.ocupacion_prom * x.salidas, 0) / sal,
        espera_prom: r.reduce((a, x) => a + x.espera_prom * x.atendidos, 0) / at,
        pct_espera_larga: r.reduce((a, x) => a + x.pct_espera_larga * x.atendidos, 0) / at,
        espera_max: Math.max(...r.map((x) => x.espera_max)),
        costo: r.reduce((a, x) => a + x.costo, 0),
        co2_kg: r.reduce((a, x) => a + x.co2_kg, 0),
        litros: r.reduce((a, x) => a + x.litros, 0),
      };
    }
    return { dias, total };
  }

  function dia(i, p, opciones = {}) {
    const d = D.semana[i];
    const real = demandaReal(i, opciones.escenario);
    const hi = heuristica(d.prophet, real, p, opciones.correccion !== false);
    return { real, inteligente: simular(hi.salidas, real, p), manual: simular(manual(d.tipo, p.flota), real, p), traza: hi.traza };
  }

  return { ciclo, heuristica, manual, simular, semana, dia, demandaReal, I, INI, FIN, KM_VIAJE };
}
