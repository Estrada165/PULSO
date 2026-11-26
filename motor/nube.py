import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
CLAVE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LIMA = timezone(timedelta(hours=-5))


def pedir(metodo, ruta, cuerpo=None, cabeceras=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{ruta}", data=datos, method=metodo)
    req.add_header("apikey", CLAVE)
    req.add_header("Authorization", f"Bearer {CLAVE}")
    req.add_header("Content-Type", "application/json")
    for k, v in (cabeceras or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=120) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else None


def uno(ruta):
    r = pedir("GET", ruta)
    return r[0] if r else None


def registros(ruta_id):
    filas, desde, paso = [], 0, 1000
    while True:
        lote = pedir("GET", f"registros_abordaje?select=fecha_hora,pasajeros&ruta_id=eq.{ruta_id}&order=fecha_hora",
                     cabeceras={"Range-Unit": "items", "Range": f"{desde}-{desde + paso - 1}"})
        filas += lote
        if len(lote) < paso:
            return filas
        desde += paso


def a_lima(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(LIMA)


def main():
    ap = argparse.ArgumentParser(description="Entrena el modelo con los registros de Supabase y publica el resultado")
    ap.add_argument("--forzar", action="store_true")
    args = ap.parse_args()
    if not URL or not CLAVE:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")

    ruta = uno("rutas?select=id,codigo&activa=eq.true&order=id&limit=1")
    if not ruta:
        sys.exit("No hay una ruta activa")
    rid = ruta["id"]
    modelo = uno(f"modelos?select=entrenado_en&ruta_id=eq.{rid}&resumen=not.is.null&order=entrenado_en.desc&limit=1")
    carga = uno(f"cargas?select=creado_en&ruta_id=eq.{rid}&order=creado_en.desc&limit=1")
    if not carga:
        print("Sin cargas registradas: nada que entrenar")
        return
    if modelo and not args.forzar and carga["creado_en"] <= modelo["entrenado_en"]:
        print("El modelo está al día")
        return

    filas = registros(rid)
    if len(filas) < 7 * 72:
        print(f"Solo hay {len(filas)} registros: se necesita al menos una semana")
        return
    print(f"Ruta {ruta['codigo']}: {len(filas):,} registros")

    with tempfile.TemporaryDirectory() as tmp:
        csv = Path(tmp) / "registros.csv"
        with open(csv, "w", encoding="utf-8") as f:
            f.write("fecha_hora,pasajeros\n")
            for x in filas:
                f.write(f"{a_lima(x['fecha_hora']).strftime('%Y-%m-%d %H:%M:%S')},{x['pasajeros']}\n")
        t0 = time.time()
        subprocess.run([sys.executable, str(RAIZ / "motor" / "main.py"), "--datos", str(csv), "--reemplazar"], check=True, cwd=RAIZ / "motor")
        segundos = round(time.time() - t0, 3)

    D = json.loads((RAIZ / "src" / "data" / "datos.json").read_text(encoding="utf-8"))
    D.pop("_leeme", None)
    D.pop("aviso", None)
    D.pop("referencia_python", None)
    mt = D["metricas"]
    nuevo = pedir("POST", "modelos", {
        "ruta_id": rid,
        "algoritmo": "prophet",
        "datos_desde": a_lima(filas[0]["fecha_hora"]).isoformat(),
        "datos_hasta": a_lima(filas[-1]["fecha_hora"]).isoformat(),
        "registros": len(filas),
        "mae": mt["prophet"]["MAE"],
        "rmse": mt["prophet"]["RMSE"],
        "mape": mt["prophet"]["MAPE"],
        "mae_empirico": mt["empirico"]["MAE"],
        "segundos_entrenamiento": segundos,
        "resumen": D,
    }, {"Prefer": "return=representation"})[0]

    ini = D["operacion"]["hora_inicio"] * 60
    paso = D["operacion"]["min_intervalo"]
    pron = []
    for dia in D["futuro"]["dias"]:
        base = datetime.fromisoformat(dia["fecha"]).replace(tzinfo=LIMA)
        for k, v in enumerate(dia["prophet"]):
            if v is None:
                continue
            lo = dia.get("inf", [None] * len(dia["prophet"]))[k]
            hi = dia.get("sup", [None] * len(dia["prophet"]))[k]
            pron.append({
                "modelo_id": nuevo["id"],
                "fecha_hora": (base + timedelta(minutes=ini + k * paso)).isoformat(),
                "valor": max(0, round(v, 2)),
                "minimo": None if lo is None else max(0, round(lo, 2)),
                "maximo": None if hi is None else max(0, round(hi, 2)),
            })
    for i in range(0, len(pron), 500):
        pedir("POST", "pronosticos", pron[i:i + 500], {"Prefer": "return=minimal"})
    print(f"Modelo {nuevo['id']} publicado · MAE {mt['prophet']['MAE']} · {len(pron)} intervalos pronosticados")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase respondió {e.code}: {e.read().decode()[:400]}")
