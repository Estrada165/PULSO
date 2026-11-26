# PULSO · Programación de salidas

Sistema web de ETUSA S.A. que pronostica la demanda de pasajeros por intervalos de 15 minutos y programa las salidas de buses de cada día. Funciona en el navegador y se puede instalar como aplicación en computadoras y celulares.

## Módulos

| Sección | Para qué sirve | Roles |
|---|---|---|
| Panel | Indicadores de la semana y estado del sistema | Todos |
| Programación | Salidas del día, aprobación, registro de pasajeros reales, CSV e impresión | Todos (aprobar: jefe y administrador) |
| Simulador | Reproduce el día minuto a minuto y prueba imprevistos | Todos |
| Pronóstico | Demanda estimada frente a la registrada y precisión del modelo | Jefe y administrador |
| Próxima semana | Pronóstico y programación de los siete días siguientes | Todos |
| Demanda | Patrones de afluencia del historial | Jefe y administrador |
| Carga de datos | Importación de registros de abordaje en CSV | Jefe y administrador |
| Parámetros | Reglas de despacho versionadas | Jefe y administrador |
| Usuarios y flota | Roles, cuentas y estado de las unidades | Administrador |

Cada sección tiene una guía interactiva paso a paso. Se abre sola la primera vez y se repite desde el botón del libro.

## Arquitectura

```
Navegador (Vite + JavaScript)  ──►  Supabase (PostgreSQL + Auth + RLS)  ◄──  GitHub Actions (Python + Prophet)
   programa las salidas               registros, cargas, modelos,            entrena el modelo cuando hay
   con el último modelo               parámetros, programaciones             cargas nuevas y publica el resumen
```

1. El jefe de operaciones sube el CSV en **Carga de datos** y los registros se guardan en `registros_abordaje`.
2. Cada hora, el flujo `Entrenar pronóstico` revisa si hay cargas nuevas. Si las hay, entrena Prophet y guarda el modelo y su pronóstico.
3. La web lee el último modelo, calcula la programación con los parámetros vigentes y la publica al aprobarla.
4. El despachador registra los pasajeros reales de cada salida.

## Puesta en marcha

### 1. Base de datos

En el SQL Editor de Supabase ejecuta, en este orden:

1. `supabase/esquema.sql` (esquema completo; ya ejecutado)
2. `supabase/migracion_v2.sql`

Crea tu usuario en **Authentication → Users → Add user** y luego ejecuta `supabase/primer_administrador.sql` con tu correo.

### 2. Variables de entorno

En **Vercel → Settings → Environment Variables** (y en `.env` para desarrollo local):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
```

En **GitHub → Settings → Secrets and variables → Actions**:

```
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_SERVICE_ROLE
```

La clave `service_role` solo va en los secretos de GitHub. Nunca en Vercel ni en el código.

### 3. Primer historial

Ingresa con la cuenta de administrador y sube `datos/registros_abordaje_R-01.csv`. Luego, en **GitHub → Actions → Entrenar pronóstico → Run workflow**, ejecútalo una vez para no esperar a la siguiente hora.

### 4. Desarrollo local

```bash
npm install
npm run dev
```

Sin variables de entorno, el sistema arranca en modo local: sin inicio de sesión, con el último modelo incluido en `src/data/datos.json` y los cambios guardados en el navegador.

Para entrenar el modelo localmente con un archivo:

```bash
pip install -r motor/requirements.txt
python motor/main.py --datos datos/registros_abordaje_R-01.csv --reemplazar
npm run verificar
```

## Formato de carga

```csv
fecha_hora,pasajeros
2026-11-02 05:00,51
2026-11-02 05:15,62
```

Se aceptan `AAAA-MM-DD HH:MM` y `DD/MM/AAAA HH:MM`, separador coma o punto y coma, minutos en 00, 15, 30 o 45.

## Instalación como aplicación

En Chrome o Edge, abre el menú de usuario y elige **Instalar aplicación**. En iPhone, usa **Compartir → Agregar a inicio**.
