import numpy as np
import pandas as pd
from pathlib import Path

import config as C

SEED = 165
ESCALA = 0.8
rng = np.random.default_rng(SEED)


def g(h, mu, sd):
    return np.exp(-0.5 * ((h - mu) / sd) ** 2)


def perfil(h, tipo):
    if tipo == "laboral":
        v = 45 + 360 * g(h, 7.2, 0.75) + 150 * g(h, 9.0, 1.3) + 110 * g(h, 13.3, 1.1) \
            + 300 * g(h, 18.3, 1.05)
    elif tipo == "sabado":
        v = 35 + 170 * g(h, 9.6, 1.6) + 150 * g(h, 13.5, 1.8) + 160 * g(h, 18.0, 1.7)
    else:
        v = 25 + 120 * g(h, 11.5, 2.2) + 110 * g(h, 17.0, 2.0)
    v *= 1 - 0.55 * g(h, 23.0, 0.9)
    return v * ESCALA


def tipo_dia(d):
    if d in C.FERIADOS or d.weekday() == 6:
        return "domingo"
    if d.weekday() == 5:
        return "sabado"
    return "laboral"


def generar():
    dias = pd.date_range(C.FECHA_INICIO, C.FECHA_FIN, freq="D")
    total_dias = len(dias)
    filas = []
    for i, dia in enumerate(dias):
        d = dia.date()
        tipo = tipo_dia(d)
        tendencia = 1 + 0.045 * i / total_dias
        vacaciones = 0.91 if (date_in(d, (7, 20), (8, 9)) or date_in(d, (12, 22), (12, 31))
                              or d.month in (1, 2)) else 1.0
        quincena = 1.05 if d.day in (15, 16, 30, 31, 1) else 1.0
        dia_semana = {0: 1.03, 1: 1.0, 2: 1.0, 3: 1.01, 4: 1.06}.get(d.weekday(), 1.0)
        nivel_dia = rng.lognormal(0, 0.05)
        evento = rng.random() < 0.03
        hora_evento = rng.uniform(15, 20)
        for k in range(C.N_INTERVALOS):
            h = C.HORA_INICIO + k * C.MIN_INTERVALO / 60
            mu = perfil(h, tipo) * tendencia * vacaciones * dia_semana * nivel_dia
            if h >= 16:
                mu *= quincena
            if evento:
                mu *= 1 + 0.6 * g(h, hora_evento, 0.8)
            mu *= rng.lognormal(0, 0.09)
            y = rng.poisson(max(mu, 0.1))
            filas.append((dia + pd.Timedelta(hours=h), y, tipo))

    df = pd.DataFrame(filas, columns=["fecha_hora", "pasajeros", "tipo_dia"])

    entren = df.fecha_hora < pd.Timestamp(C.INICIO_PRUEBA)
    faltan = entren & (rng.random(len(df)) < 0.03)
    df["pasajeros"] = df["pasajeros"].astype("float")
    df.loc[faltan, "pasajeros"] = np.nan
    return df


def date_in(d, ini, fin):
    return (d.month, d.day) >= ini and (d.month, d.day) <= fin


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "salidas"
    out.mkdir(exist_ok=True)
    df = generar()
    df.to_csv(out / "abordajes.csv", index=False)
    print(f"{len(df):,} registros | {df.pasajeros.isna().sum()} faltantes | "
          f"{df.fecha_hora.dt.date.nunique()} días | total pasajeros {df.pasajeros.sum():,.0f}")


def leer_fechas(serie):
    f = pd.to_datetime(serie, errors="coerce", format="mixed")
    if f.isna().mean() > 0.5 or serie.astype(str).str.match(r"^\d{1,2}/").mean() > 0.5:
        f = pd.to_datetime(serie, errors="coerce", dayfirst=True, format="mixed")
    return f


def cargar(ruta):


    ruta = str(ruta)
    df = pd.read_excel(ruta) if ruta.endswith((".xlsx", ".xls")) else pd.read_csv(ruta)
    df.columns = [c.strip().lower() for c in df.columns]
    faltan = {"fecha_hora", "pasajeros"} - set(df.columns)
    if faltan:
        raise SystemExit(f"Al archivo le faltan columnas: {', '.join(sorted(faltan))}")
    df["fecha_hora"] = leer_fechas(df["fecha_hora"])
    df = df.dropna(subset=["fecha_hora"])
    df["fecha_hora"] = df["fecha_hora"].dt.floor(f"{C.MIN_INTERVALO}min")
    df = df.groupby("fecha_hora", as_index=False)["pasajeros"].sum()
    h = df.fecha_hora.dt.hour
    df = df[(h >= C.HORA_INICIO) & (h < C.HORA_FIN)]
    dias = pd.date_range(df.fecha_hora.min().normalize(), df.fecha_hora.max().normalize(), freq="D")
    rejilla = pd.DataFrame({"fecha_hora": [d + pd.Timedelta(minutes=C.HORA_INICIO * 60 + k * C.MIN_INTERVALO)
                                          for d in dias for k in range(C.N_INTERVALOS)]})
    df = rejilla.merge(df, on="fecha_hora", how="left")
    df["tipo_dia"] = [tipo_dia(d.date()) for d in df.fecha_hora]
    return df[["fecha_hora", "pasajeros", "tipo_dia"]]
