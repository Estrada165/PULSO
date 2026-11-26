import json
from pathlib import Path

import numpy as np
import pandas as pd

import config as C

RAIZ = Path(__file__).resolve().parent.parent
DATA, WEB = Path(__file__).resolve().parent / "salidas", RAIZ / "src" / "data"


def r1(a):
    return [None if pd.isna(x) else round(float(x), 1) for x in a]


FRANJAS = [("Madrugada", 5, 6), ("Punta mañana", 6, 9), ("Valle", 9, 16), ("Punta tarde", 16, 20), ("Noche", 20, 23)]


def prueba_h1(hist):
    from scipy.stats import kruskal
    h = hist.dropna(subset=["pasajeros"]).copy()
    h["hora"] = h.fecha_hora.dt.hour + h.fecha_hora.dt.minute / 60
    lab = h[h.tipo_dia == "laboral"]
    grupos_f = [lab[(lab.hora >= a) & (lab.hora < b)].pasajeros.to_numpy() for _, a, b in FRANJAS]
    kf = kruskal(*grupos_f)
    n = sum(len(g) for g in grupos_f)
    diario = h.groupby([h.fecha_hora.dt.date, "tipo_dia"]).pasajeros.sum().reset_index()
    grupos_d = [diario[diario.tipo_dia == t].pasajeros.to_numpy() for t in ("laboral", "sabado", "domingo")]
    kd = kruskal(*grupos_d)
    nd = sum(len(g) for g in grupos_d)
    return {
        "franja": {"H": float(kf.statistic), "p": float(kf.pvalue), "n": int(n), "gl": len(grupos_f) - 1,
                   "epsilon2": float(kf.statistic / (n - 1)),
                   "grupos": [{"nombre": f[0], "media": float(g.mean()), "mediana": float(np.median(g))} for f, g in zip(FRANJAS, grupos_f)]},
        "tipo_dia": {"H": float(kd.statistic), "p": float(kd.pvalue), "n": int(nd), "gl": 2,
                     "epsilon2": float(kd.statistic / (nd - 1)),
                     "grupos": [{"nombre": t, "media": float(g.mean()), "mediana": float(np.median(g))} for t, g in zip(("Laboral", "Sábado", "Domingo y feriado"), grupos_d)]},
    }


def legible(obj):
    import re
    txt = json.dumps(obj, ensure_ascii=False, indent=2)
    return re.sub(r"\[\s*([-\d.eE,\s]+?|null[,\s\w.-]*?)\s*\]",
                  lambda m: "[" + ", ".join(x.strip() for x in m.group(1).split(",")) + "]"
                  if "\n" in m.group(0) and "{" not in m.group(0) else m.group(0), txt)


def main():
    hist = pd.read_csv(DATA / "abordajes.csv", parse_dates=["fecha_hora"])
    fc = pd.read_csv(DATA / "pronostico_semana.csv", parse_dates=["ds"])
    met = json.load(open(DATA / "metricas_pronostico.json"))
    sim = json.load(open(DATA / "resultados_simulacion.json"))

    hist["fecha"] = hist.fecha_hora.dt.strftime("%Y-%m-%d")
    diario = hist.groupby("fecha").agg(total=("pasajeros", "sum"),
                                       faltantes=("pasajeros", lambda s: int(s.isna().sum())),
                                       tipo=("tipo_dia", "first")).reset_index()

    entren = hist[hist.fecha_hora < pd.Timestamp(C.INICIO_PRUEBA)].copy()
    entren["dow"] = entren.fecha_hora.dt.weekday
    entren["hora"] = entren.fecha_hora.dt.hour
    es_fer = entren.fecha_hora.dt.date.isin(C.FERIADOS.keys())
    calor = entren[~es_fer].groupby(["dow", "hora"]).pasajeros.mean().unstack()
    calor = (calor * 4).round(0)

    fc["fecha"] = fc.ds.dt.strftime("%Y-%m-%d")
    semana = []
    for f, g in fc.groupby("fecha"):
        d = pd.Timestamp(f)
        tipo = "domingo" if d.weekday() == 6 or d.date() in C.FERIADOS else \
            ("sabado" if d.weekday() == 5 else "laboral")
        semana.append({"fecha": f, "tipo": tipo, "real": r1(g.y), "prophet": r1(g.prophet),
                       "inf": r1(g.prophet_inf), "sup": r1(g.prophet_sup),
                       "empirico": r1(g.empirico)})

    fut = pd.read_csv(DATA / "pronostico_futuro.csv", parse_dates=["ds"])
    fut["fecha"] = fut.ds.dt.strftime("%Y-%m-%d")
    futuro = []
    for f, g in fut.groupby("fecha"):
        d = pd.Timestamp(f)
        tipo = "domingo" if d.weekday() == 6 or d.date() in C.FERIADOS else ("sabado" if d.weekday() == 5 else "laboral")
        futuro.append({"fecha": f, "tipo": tipo, "feriado": C.FERIADOS.get(d.date()),
                       "prophet": r1(g.prophet), "inf": r1(g.prophet_inf), "sup": r1(g.prophet_sup)})

    out = {
        "generado": pd.Timestamp.now(tz="America/Lima").isoformat(timespec="seconds"),
        "semana_inicio": C.INICIO_PRUEBA.isoformat(),
        "ruta": C.RUTA,
        "operacion": {"hora_inicio": C.HORA_INICIO, "hora_fin": C.HORA_FIN,
                      "min_intervalo": C.MIN_INTERVALO, "n_intervalos": C.N_INTERVALOS},
        "params": C.PARAMS,
        "ciclo": C.CICLO,
        "tabla_manual": C.TABLA_MANUAL,
        "costos": {"consumo_l_km": C.CONSUMO_L_KM, "precio_l": C.PRECIO_L, "co2_kg_l": C.CO2_KG_L},
        "feriados": {k.isoformat(): v for k, v in C.FERIADOS.items()
                     if C.FECHA_INICIO <= k <= C.FECHA_FIN},
        "historico": {
            "desde": C.FECHA_INICIO.isoformat(), "hasta": C.FECHA_FIN.isoformat(),
            "registros": int(len(hist)), "faltantes": int(hist.pasajeros.isna().sum()),
            "diario": diario.to_dict(orient="records"),
            "calor": calor.fillna(0).astype(int).values.tolist(),
            "calor_horas": [int(h) for h in calor.columns],
        },
        "metricas": met,
        "h1": prueba_h1(hist[hist.fecha_hora < pd.Timestamp(C.INICIO_PRUEBA)]),
        "semana": semana,
        "futuro": {"ultimo_dato": C.FECHA_FIN.isoformat(), "dias": futuro},
        "referencia_python": sim["total"],
    }
    WEB.mkdir(exist_ok=True)
    txt = legible(out)
    (WEB / "datos.json").write_text(txt, encoding="utf-8")
    print(f"datos.json {len(txt)/1024:.0f} KB")


if __name__ == "__main__":
    main()
