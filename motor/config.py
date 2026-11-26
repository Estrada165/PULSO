import os
from datetime import date, timedelta


def _lunes(d: date) -> date:
    return d - timedelta(days=d.weekday())


_ref = os.environ.get("PULSO_SEMANA")
FECHA_REF = date.fromisoformat(_ref) if _ref else date.today()

INICIO_PRUEBA = _lunes(FECHA_REF)
FECHA_FIN = INICIO_PRUEBA + timedelta(days=6)
SEMANAS_HISTORIA = 26
FECHA_INICIO = INICIO_PRUEBA - timedelta(weeks=SEMANAS_HISTORIA)

HORA_INICIO = 5
HORA_FIN = 23
MIN_INTERVALO = 15
N_INTERVALOS = (HORA_FIN - HORA_INICIO) * 60 // MIN_INTERVALO

RUTA = {
    "codigo": "R-01",
    "nombre": "Corredor Terminal Norte – Terminal Sur",
    "km_ida": 21.0,
    "paraderos": 9,
}

PARAMS = {
    "capacidad": 85,
    "ocupacion_objetivo": 0.80,
    "ocupacion_minima": 0.30,
    "espera_maxima": 10,
    "intervalo_minimo": 2,
    "flota": 45,
    "factor_seguridad": 1.05,
    "umbral_correccion": 0.12,
    "alpha_correccion": 0.6,
    "correccion_min": 0.80,
    "correccion_max": 1.40,
}

CICLO = [(5, 6, 85), (6, 10, 115), (10, 16, 95), (16, 21, 115), (21, 23, 85)]

CONSUMO_L_KM = 0.40
PRECIO_L = 4.20
CO2_KG_L = 2.68

FERIADOS = {
    date(2025, 12, 8): "Inmaculada Concepción", date(2025, 12, 9): "Batalla de Ayacucho",
    date(2025, 12, 25): "Navidad",
    date(2026, 1, 1): "Año Nuevo", date(2026, 4, 2): "Jueves Santo", date(2026, 4, 3): "Viernes Santo",
    date(2026, 5, 1): "Día del Trabajo", date(2026, 6, 7): "Batalla de Arica",
    date(2026, 6, 29): "San Pedro y San Pablo", date(2026, 7, 23): "Día de la Fuerza Aérea",
    date(2026, 7, 28): "Fiestas Patrias", date(2026, 7, 29): "Fiestas Patrias",
    date(2026, 8, 6): "Batalla de Junín", date(2026, 8, 30): "Santa Rosa de Lima",
    date(2026, 10, 8): "Combate de Angamos", date(2026, 11, 1): "Todos los Santos",
    date(2026, 12, 8): "Inmaculada Concepción", date(2026, 12, 9): "Batalla de Ayacucho",
    date(2026, 12, 25): "Navidad",
    date(2027, 1, 1): "Año Nuevo", date(2027, 3, 25): "Jueves Santo", date(2027, 3, 26): "Viernes Santo",
    date(2027, 5, 1): "Día del Trabajo", date(2027, 6, 7): "Batalla de Arica",
    date(2027, 6, 29): "San Pedro y San Pablo", date(2027, 7, 23): "Día de la Fuerza Aérea",
    date(2027, 7, 28): "Fiestas Patrias", date(2027, 7, 29): "Fiestas Patrias",
    date(2027, 8, 6): "Batalla de Junín", date(2027, 8, 30): "Santa Rosa de Lima",
    date(2027, 10, 8): "Combate de Angamos", date(2027, 11, 1): "Todos los Santos",
    date(2027, 12, 8): "Inmaculada Concepción", date(2027, 12, 9): "Batalla de Ayacucho",
    date(2027, 12, 25): "Navidad",
}

TABLA_MANUAL = {
    "laboral": [(5, 6, 8), (6, 9, 4), (9, 12, 6), (12, 15, 6), (15, 17, 6),
                (17, 20, 4), (20, 22, 8), (22, 23, 12)],
    "sabado": [(5, 7, 10), (7, 21, 6), (21, 23, 12)],
    "domingo": [(5, 10, 12), (10, 19, 8), (19, 23, 12)],
}
