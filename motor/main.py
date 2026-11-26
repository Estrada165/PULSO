import argparse
import os

import pandas as pd
import sys
from pathlib import Path

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Motor PULSO")
    ap.add_argument("--semana", help="fecha (AAAA-MM-DD) dentro de la semana operativa a generar")
    ap.add_argument("--datos", help="CSV o Excel con registros reales (fecha_hora, pasajeros[, tipo_dia])")
    ap.add_argument("--reemplazar", action="store_true", help="descarta el historial acumulado y usa solo el archivo nuevo")
    args = ap.parse_args()
    if args.datos and not args.semana:
        crudo = pd.read_excel(args.datos) if args.datos.endswith((".xlsx", ".xls")) else pd.read_csv(args.datos)
        crudo.columns = [c.strip().lower() for c in crudo.columns]
        texto = crudo["fecha_hora"].astype(str)
        dia_primero = texto.str.match(r"^\d{1,2}/").mean() > 0.5
        ultimo = pd.to_datetime(texto, errors="coerce", dayfirst=dia_primero, format="mixed").max().normalize()
        domingo = ultimo - pd.Timedelta(days=(ultimo.weekday() + 1) % 7)
        os.environ["PULSO_SEMANA"] = str(domingo.date())
    if args.semana:
        os.environ["PULSO_SEMANA"] = args.semana

    import config as C
    import generar_datos, pronostico, despacho, exportar

    out = Path(__file__).resolve().parent.parent / "motor" / "salidas"
    out.mkdir(exist_ok=True)
    print(f"Semana operativa: {C.INICIO_PRUEBA} a {C.FECHA_FIN} | historial desde {C.FECHA_INICIO}")
    if args.datos:
        print(f"1/4 Importando registros reales desde {args.datos}...")
        nuevo = generar_datos.cargar(args.datos)
        historial = Path(__file__).resolve().parent.parent / "datos" / "abordajes_reales.csv"
        if historial.exists() and not args.reemplazar:
            previo = pd.read_csv(historial, parse_dates=["fecha_hora"])
            df = (pd.concat([previo, nuevo]).sort_values("fecha_hora")
                  .drop_duplicates("fecha_hora", keep="last").reset_index(drop=True))
            print(f"    se agregan {len(nuevo):,} registros a los {len(previo):,} existentes")
        else:
            df = nuevo
        df.to_csv(Path(__file__).resolve().parent / "salidas" / "historial_completo.csv", index=False)
        completo = df.copy()
        df = df[(df.fecha_hora >= str(C.FECHA_INICIO)) & (df.fecha_hora < str(C.FECHA_FIN + __import__('datetime').timedelta(days=1)))]
    else:
        print("1/4 Generando datos simulados...")
        df = generar_datos.generar()
    df.to_csv(out / "abordajes.csv", index=False)
    raiz = Path(__file__).resolve().parent.parent / "datos"
    raiz.mkdir(exist_ok=True)
    copia = (completo if args.datos else df).copy(); copia["pasajeros"] = copia["pasajeros"].round().astype("Int64")
    copia.to_csv(raiz / ("abordajes_reales.csv" if args.datos else "abordajes_simulados.csv"), index=False)
    print(f"    {len(df):,} registros, {int(df.pasajeros.isna().sum())} faltantes")
    print("2/4 Entrenando Prophet y evaluando...")
    pronostico.main()
    print("3/4 Heurística adaptativa y simulación operativa...")
    despacho.main()
    print("4/4 Exportando al panel web...")
    exportar.main()
