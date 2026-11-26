import json
import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd
from prophet import Prophet

import config as C

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
logging.getLogger("prophet").setLevel(logging.WARNING)

DATA = Path(__file__).resolve().parent / "salidas"


def agregar_condiciones(df):
    f = df["ds"].dt.date
    es_feriado = f.isin(C.FERIADOS.keys())
    dow = df["ds"].dt.weekday
    df["es_laboral"] = (~es_feriado) & (dow < 5)
    df["es_sabado"] = (~es_feriado) & (dow == 5)
    df["es_domingo"] = es_feriado | (dow == 6)
    return df


def crear_modelo():
    feriados = pd.DataFrame({
        "holiday": "feriado_nacional",
        "ds": pd.to_datetime(list(C.FERIADOS.keys())),
        "lower_window": 0, "upper_window": 0,
    })
    m = Prophet(
        growth="linear",
        daily_seasonality=False,
        weekly_seasonality=6,
        yearly_seasonality=False,
        seasonality_mode="multiplicative",
        holidays=feriados,
        changepoint_prior_scale=0.02,
        interval_width=0.80,
    )
    for nombre in ("laboral", "sabado", "domingo"):
        m.add_seasonality(name=f"diaria_{nombre}", period=1, fourier_order=14,
                          condition_name=f"es_{nombre}")
    return m


def pronostico_empirico(hist, objetivo):
    h = hist.copy()
    h["dow"] = h.ds.dt.weekday
    h["slot"] = h.ds.dt.hour * 60 + h.ds.dt.minute
    corte = hist.ds.max() - pd.Timedelta(days=28)
    base = h[h.ds > corte].groupby(["dow", "slot"]).y.mean()
    o = objetivo.ds
    idx = list(zip(o.dt.weekday, o.dt.hour * 60 + o.dt.minute))
    return base.reindex(idx).to_numpy()


def metricas(real, pred):
    real, pred = np.asarray(real, float), np.asarray(pred, float)
    ok = ~np.isnan(real)
    e = real[ok] - pred[ok]
    m20 = ok & (real >= 20)
    return {
        "MAE": float(np.mean(np.abs(e))),
        "RMSE": float(np.sqrt(np.mean(e ** 2))),
        "MAPE": float(np.mean(np.abs((real[m20] - pred[m20]) / real[m20])) * 100),
    }


def main():
    df = pd.read_csv(DATA / "abordajes.csv", parse_dates=["fecha_hora"])
    df = df.rename(columns={"fecha_hora": "ds", "pasajeros": "y"})[["ds", "y"]]
    df = agregar_condiciones(df)

    corte = pd.Timestamp(C.INICIO_PRUEBA)
    entren = df[df.ds < corte].dropna(subset=["y"])
    prueba = df[df.ds >= corte].copy()

    t0 = time.perf_counter()
    m = crear_modelo()
    m.fit(entren)
    t_fit = time.perf_counter() - t0

    t0 = time.perf_counter()
    fc = m.predict(prueba[["ds", "es_laboral", "es_sabado", "es_domingo"]])
    t_pred = time.perf_counter() - t0

    prueba["prophet"] = fc["yhat"].clip(lower=0).to_numpy()
    prueba["prophet_inf"] = fc["yhat_lower"].clip(lower=0).to_numpy()
    prueba["prophet_sup"] = fc["yhat_upper"].clip(lower=0).to_numpy()
    prueba["empirico"] = pronostico_empirico(entren, prueba)

    res = {
        "prophet": metricas(prueba.y, prueba.prophet),
        "empirico": metricas(prueba.y, prueba.empirico),
        "tiempo_entrenamiento_s": round(t_fit, 2),
        "tiempo_prediccion_s": round(t_pred, 3),
        "registros_entrenamiento": int(len(entren)),
        "registros_faltantes_omitidos": int(df[df.ds < corte].y.isna().sum()),
    }
    res["mejora_mae_pct"] = 100 * (1 - res["prophet"]["MAE"] / res["empirico"]["MAE"])
    res["mejora_rmse_pct"] = 100 * (1 - res["prophet"]["RMSE"] / res["empirico"]["RMSE"])

    lunes = pd.Timestamp(C.INICIO_PRUEBA)
    grid = pd.DataFrame({"ds": pd.date_range(lunes + pd.Timedelta(hours=5), lunes + pd.Timedelta(hours=22, minutes=45), freq="15min")})
    comp = {}
    for nombre in ("laboral", "sabado", "domingo"):
        g = agregar_condiciones(grid.copy())
        for c in ("es_laboral", "es_sabado", "es_domingo"):
            g[c] = c == f"es_{nombre}"
        p = m.predict(g)
        comp[nombre] = p[f"diaria_{nombre}"].round(4).tolist()
    sem = pd.DataFrame({"ds": pd.date_range(lunes + pd.Timedelta(hours=12), periods=7, freq="D")})
    sem = agregar_condiciones(sem)
    comp["semanal"] = m.predict(sem)["weekly"].round(4).tolist()
    fut = pd.DataFrame({"ds": pd.date_range(C.FECHA_INICIO, C.FECHA_FIN, freq="D")})
    fut = agregar_condiciones(fut)
    comp["tendencia"] = m.predict(fut)["trend"].round(2).tolist()
    fer = [f for f in C.FERIADOS if C.FECHA_INICIO <= f < C.INICIO_PRUEBA]
    comp["feriado"] = float(m.predict(agregar_condiciones(pd.DataFrame(
        {"ds": [pd.Timestamp(fer[-1]) + pd.Timedelta(hours=12)]})))["holidays"].iloc[0]) if fer else 0.0
    res["componentes"] = comp

    prueba["y"] = prueba["y"].fillna(prueba["prophet"].round())
    completo = df.dropna(subset=["y"])
    m_fut = crear_modelo()
    m_fut.fit(completo)
    inicio_fut = pd.Timestamp(C.FECHA_FIN) + pd.Timedelta(days=1)
    horas = [pd.Timedelta(minutes=C.HORA_INICIO * 60 + k * C.MIN_INTERVALO) for k in range(C.N_INTERVALOS)]
    futuro = pd.DataFrame({"ds": [inicio_fut + pd.Timedelta(days=d) + h for d in range(7) for h in horas]})
    futuro = agregar_condiciones(futuro)
    pf = m_fut.predict(futuro)
    futuro["prophet"] = pf["yhat"].clip(lower=0).to_numpy()
    futuro["prophet_inf"] = pf["yhat_lower"].clip(lower=0).to_numpy()
    futuro["prophet_sup"] = pf["yhat_upper"].clip(lower=0).to_numpy()
    futuro[["ds", "prophet", "prophet_inf", "prophet_sup"]].to_csv(DATA / "pronostico_futuro.csv", index=False)

    prueba[["ds", "y", "prophet", "prophet_inf", "prophet_sup", "empirico"]].to_csv(
        DATA / "pronostico_semana.csv", index=False)
    with open(DATA / "metricas_pronostico.json", "w") as f:
        json.dump(res, f, indent=2, ensure_ascii=False)

    print(f"Prophet  MAE {res['prophet']['MAE']:.1f}  RMSE {res['prophet']['RMSE']:.1f}  "
          f"MAPE {res['prophet']['MAPE']:.1f}%")
    print(f"Empírico MAE {res['empirico']['MAE']:.1f}  RMSE {res['empirico']['RMSE']:.1f}  "
          f"MAPE {res['empirico']['MAPE']:.1f}%")
    print(f"Mejora MAE {res['mejora_mae_pct']:.1f}% | entrenamiento {t_fit:.1f}s | "
          f"predicción {t_pred:.2f}s")


if __name__ == "__main__":
    main()
