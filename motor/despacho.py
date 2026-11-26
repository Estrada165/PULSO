import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

import config as C

DATA = Path(__file__).resolve().parent / "salidas"
I = C.MIN_INTERVALO


def red2(x):
    return math.floor(x * 100 + 0.5) / 100


def ciclo(minuto_dia):
    h = minuto_dia / 60
    for a, b, t in C.CICLO:
        if a <= h < b:
            return t
    return C.CICLO[-1][2]


def disponibles(salidas, minuto, flota):
    en_ruta = sum(1 for s in salidas if s > minuto - ciclo(s))
    return max(0, flota - en_ruta)


def proximo_retorno(salidas, minuto):
    return min(s + ciclo(s) for s in salidas if s + ciclo(s) > minuto)


def heuristica(pronostico, real, p):
    inicio, fin = C.HORA_INICIO * 60, C.HORA_FIN * 60
    salidas, traza = [], []
    t, factor, cerrado = float(inicio), 1.0, -1
    while t < fin:
        k = int((t - inicio) // I)
        while real is not None and cerrado < k - 1:
            cerrado += 1
            if pronostico[cerrado] > 1:
                r = real[cerrado] / pronostico[cerrado]
                if abs(r - 1) > p["umbral_correccion"]:
                    factor = p["alpha_correccion"] * r + (1 - p["alpha_correccion"]) * factor
                else:
                    factor = 0.5 * factor + 0.5
                factor = min(max(factor, p["correccion_min"]), p["correccion_max"])
        D = pronostico[k] * factor
        tasa = D * p["factor_seguridad"] / I
        h = (p["capacidad"] * p["ocupacion_objetivo"] / tasa) if tasa > 0 else 1e9
        regla = "capacidad"
        if h > p["espera_maxima"]:
            h, regla = p["espera_maxima"], "espera_maxima"
        if h < p["intervalo_minimo"]:
            h, regla = p["intervalo_minimo"], "anden"
        if disponibles(salidas, t, p["flota"]) == 0:
            t = proximo_retorno(salidas, t)
            if traza:
                traza[-1]["regla"] = "flota"
            continue
        salidas.append(red2(t))
        traza.append({"t": red2(t), "intervalo": red2(h), "demanda_disenio": round(D, 1),
                      "regla": regla, "factor": round(factor, 3)})
        t += h
    return salidas, traza


def manual(tipo, flota):
    salidas = []
    for a, b, h in C.TABLA_MANUAL[tipo]:
        t = a * 60
        while t < b * 60:
            if disponibles(salidas, t, flota) > 0:
                salidas.append(t)
            t += h
    return salidas


def simular(salidas, real, p):
    salidas = sorted(salidas)
    inicio = C.HORA_INICIO * 60
    cola = []
    espera_total, atendidos, max_espera, larga = 0.0, 0.0, 0.0, 0.0
    viajes = []
    j = 0
    for minuto in range(inicio, C.HORA_FIN * 60):
        k = (minuto - inicio) // I
        cola.append([minuto + 0.5, real[k] / I])
        while j < len(salidas) and salidas[j] < minuto + 1:
            ts = salidas[j]
            cupo, abordo = p["capacidad"], 0.0
            while cola and cupo > 1e-9 and cola[0][0] <= ts + 1e-9:
                tom = min(cupo, cola[0][1])
                w = ts - cola[0][0]
                espera_total += tom * w
                max_espera = max(max_espera, w)
                if w > p["espera_maxima"]:
                    larga += tom
                cupo -= tom
                abordo += tom
                cola[0][1] -= tom
                if cola[0][1] <= 1e-9:
                    cola.pop(0)
            atendidos += abordo
            viajes.append(abordo / p["capacidad"])
            j += 1
    pendientes = sum(c[1] for c in cola)
    km_viaje = C.RUTA["km_ida"] * 2
    vacios = sum(1 for o in viajes if o < p["ocupacion_minima"])
    n = len(viajes)
    km = n * km_viaje
    return {
        "salidas": n,
        "km": km,
        "km_vacio": vacios * km_viaje,
        "ocupacion_prom": float(np.mean(viajes)) if n else 0.0,
        "espera_prom": espera_total / atendidos if atendidos else 0.0,
        "espera_max": max_espera,
        "atendidos": atendidos,
        "pct_espera_larga": 100 * larga / atendidos if atendidos else 0.0,
        "no_atendidos": pendientes,
        "litros": km * C.CONSUMO_L_KM,
        "costo": km * C.CONSUMO_L_KM * C.PRECIO_L,
        "co2_kg": km * C.CONSUMO_L_KM * C.CO2_KG_L,
        "ocupaciones": [round(o, 3) for o in viajes],
    }


def tipo_dia(fecha):
    d = fecha.date()
    if d in C.FERIADOS or d.weekday() == 6:
        return "domingo"
    return "sabado" if d.weekday() == 5 else "laboral"


def main(p=C.PARAMS):
    fc = pd.read_csv(DATA / "pronostico_semana.csv", parse_dates=["ds"])
    fc["fecha"] = fc.ds.dt.normalize()
    dias = []
    for fecha, g in fc.groupby("fecha"):
        real = g.y.to_numpy(float)
        pron = np.array([round(float(x), 1) for x in g.prophet])
        tipo = tipo_dia(fecha)
        s_man = manual(tipo, p["flota"])
        s_int, traza = heuristica(pron, real, p)
        dias.append({
            "fecha": fecha.strftime("%Y-%m-%d"), "tipo": tipo,
            "manual": simular(s_man, real, p),
            "inteligente": simular(s_int, real, p),
            "traza": traza,
        })
    tot = {}
    for esquema in ("manual", "inteligente"):
        r = [d[esquema] for d in dias]
        at = sum(x["atendidos"] for x in r)
        tot[esquema] = {
            "salidas": sum(x["salidas"] for x in r),
            "km": sum(x["km"] for x in r),
            "km_vacio": sum(x["km_vacio"] for x in r),
            "ocupacion_prom": float(np.average([x["ocupacion_prom"] for x in r],
                                               weights=[x["salidas"] for x in r])),
            "espera_prom": sum(x["espera_prom"] * x["atendidos"] for x in r) / at,
            "pct_espera_larga": sum(x["pct_espera_larga"] * x["atendidos"] for x in r) / at,
            "espera_max": max(x["espera_max"] for x in r),
            "costo": sum(x["costo"] for x in r),
            "co2_kg": sum(x["co2_kg"] for x in r),
        }
    with open(DATA / "resultados_simulacion.json", "w") as f:
        json.dump({"params": p, "dias": dias, "total": tot}, f, ensure_ascii=False)

    m, a = tot["manual"], tot["inteligente"]
    print(f"{'':16}{'Manual':>12}{'Inteligente':>14}{'Var %':>9}")
    for key in ("salidas", "km", "km_vacio", "ocupacion_prom", "espera_prom", "pct_espera_larga", "espera_max", "costo", "co2_kg"):
        var = 100 * (a[key] / m[key] - 1) if m[key] else 0
        print(f"{key:16}{m[key]:12.2f}{a[key]:14.2f}{var:9.1f}")
    for d in dias:
        print(d["fecha"], d["tipo"], "salidas", d["manual"]["salidas"], d["inteligente"]["salidas"],
              "espera", round(d["manual"]["espera_prom"], 2), round(d["inteligente"]["espera_prom"], 2),
              "pend", round(d["manual"]["no_atendidos"]), round(d["inteligente"]["no_atendidos"]))


if __name__ == "__main__":
    main()
