export const GUIAS = {
  panel: [
    { titulo: 'Bienvenido a PULSO', texto: 'Este es el <b>panel de operación</b> de la ruta. Aquí ves de un vistazo cómo va la semana y cuánto mejora el servicio frente al horario base.' },
    { objetivo: '.dias', titulo: 'Elige el día', texto: 'Toca cualquier día de la semana para ver su programación, su pronóstico y sus indicadores. El día de hoy está marcado.' },
    { objetivo: '[data-guia="kpis"]', titulo: 'Indicadores clave', texto: 'Kilómetros en vacío, espera, ocupación y costo. Debajo de cada número ves el valor del <b>horario base</b> y la diferencia en verde o rojo.' },
    { objetivo: '[data-guia="oferta"]', titulo: 'Oferta frente a demanda', texto: 'La curva muestra los asientos ofrecidos hora por hora contra los pasajeros que llegan. Pasa el cursor o el dedo para ver el detalle.' },
    { objetivo: '[data-guia="estado"]', titulo: 'Estado del sistema', texto: 'Cuándo se cargaron los últimos registros, qué tan preciso es el modelo y cuántas salidas hay hoy. Cada tarjeta te lleva a su sección.' },
    { objetivo: '#btn-guia', titulo: 'Vuelve cuando quieras', texto: 'Cada sección tiene su propia guía. Toca este botón para repetirla en cualquier momento.' },
  ],
  programacion: [
    { objetivo: '[data-guia="pr-aprob"]', titulo: 'Borrador y aprobación', texto: 'El sistema calcula la programación del día. El <b>jefe de operaciones</b> la revisa y la aprueba; desde ese momento queda publicada para los despachadores.' },
    { objetivo: '[data-guia="pr-pizarra"]', titulo: 'Pizarra del terminal', texto: 'Las próximas salidas tal como se verían en el andén: hora, unidad, andén y estado. Se actualiza sola.' },
    { objetivo: '[data-guia="pr-kpis"]', titulo: 'Resumen del día', texto: 'Total de salidas, primera y última, rango de intervalos y unidades en servicio.' },
    { objetivo: '[data-guia="pr-tabla"]', titulo: 'Cronograma completo', texto: 'Filtra por franja horaria. La columna <b>Regla aplicada</b> explica por qué el bus sale a esa hora. Con la programación aprobada aparece <b>Pasajeros reales</b> para que el despachador registre cuántos subieron.' },
    { objetivo: '#exportar', titulo: 'Llévatelo', texto: 'Descarga el cronograma en CSV para Excel o imprímelo para el andén.' },
  ],
  simulador: [
    { objetivo: '.control', titulo: 'Reproduce el día', texto: 'Dale play para ver la operación minuto a minuto. Arrastra la barra para saltar a cualquier hora o usa <b>Directo</b> para ir a la hora actual.' },
    { objetivo: '#corredor', titulo: 'Buses en el corredor', texto: 'Arriba, el horario base; abajo, PULSO. Mismos pasajeros, distinta distribución de buses.' },
    { objetivo: '#medidores', titulo: 'Cola en el terminal', texto: 'Cuántas personas esperan en cada esquema en este momento.' },
    { objetivo: '#card-imp', titulo: 'Provoca un imprevisto', texto: 'Simula una subida o bajada de pasajeros. El sistema detecta la diferencia con el pronóstico y corrige los intervalos en minutos.' },
    { objetivo: '#bitacora', titulo: 'Bitácora de decisiones', texto: 'Cada cambio de regla o corrección queda registrado con su hora.' },
  ],
  demanda: [
    { objetivo: '#calor', titulo: 'Mapa de afluencia', texto: 'Cada celda es una hora de un día de la semana. Más intenso, más pasajeros. Así se detectan las horas punta.' },
    { objetivo: '#ficha', titulo: 'Ficha del historial', texto: 'Cantidad de registros, rango de fechas y faltantes del historial cargado.' },
    { objetivo: '#g-diario', titulo: 'Pasajeros por día', texto: 'La tendencia diaria completa. Los feriados se marcan aparte porque se comportan distinto.' },
  ],
  pronostico: [
    { objetivo: '[data-seg="alcance-p"]', titulo: 'Día o semana', texto: 'Cambia entre el detalle del día elegido y la vista de toda la semana.' },
    { objetivo: '#g-pron', titulo: 'Pronóstico frente a lo real', texto: 'La línea del modelo, su banda de confianza y lo que realmente se registró. Si la línea sigue a los puntos, el modelo acierta.' },
    { objetivo: '#metricas', titulo: 'Precisión', texto: 'El error del modelo comparado con el método de promedios. Toca <b>i</b> en cualquier sigla para ver qué significa.' },
  ],
  proxima: [
    { objetivo: '#estado-datos', titulo: 'Desde el último dato', texto: 'El pronóstico arranca desde el último registro cargado.' },
    { objetivo: '#dias-fut', titulo: 'Los próximos siete días', texto: 'Pasajeros esperados y salidas previstas para cada día. Toca uno para ver su curva.' },
    { objetivo: '#plan', titulo: 'Programación preparada', texto: 'La propuesta de salidas por franja para el día elegido, lista antes de que lleguen los pasajeros.' },
  ],
  carga: [
    { objetivo: '#plantilla', titulo: 'Usa la plantilla', texto: 'Descarga el formato: dos columnas, <b>fecha_hora</b> y <b>pasajeros</b>, en intervalos de 15 minutos.' },
    { objetivo: '[data-guia="c-soltar"]', titulo: 'Sube el archivo', texto: 'Arrástralo aquí o elígelo. Antes de importar verás una vista previa y las filas con error que se omitirán.' },
    { objetivo: '[data-guia="c-modelo"]', titulo: 'Entrenamiento automático', texto: 'Tras cada carga el modelo se vuelve a entrenar solo. Aquí ves si está al día o en cola.' },
    { objetivo: '[data-guia="c-hist"]', titulo: 'Historial de cargas', texto: 'Quién cargó qué rango de fechas y cuándo.' },
  ],
  parametros: [
    { objetivo: '.g-param .col .tarjeta', titulo: 'Ajusta las reglas', texto: 'Mueve los controles: ocupación objetivo, espera máxima, flota disponible y más. La semana se recalcula al instante.' },
    { objetivo: '#formula', titulo: 'Lógica aplicada', texto: 'Los pasos con que se calcula cada intervalo, con tus valores actuales.' },
    { objetivo: '#resultado', titulo: 'Impacto inmediato', texto: 'Cómo cambian los indicadores de la semana con la configuración que estás probando.' },
    { objetivo: '[data-guia="p-estado"]', titulo: 'Guarda para aplicar', texto: 'Mientras no guardes, los cambios son solo una prueba. Al guardar, rigen para toda la operación y quedan versionados.' },
  ],
  usuarios: [
    { objetivo: '[data-seg="pest-u"]', titulo: 'Usuarios y flota', texto: 'Cambia entre la gestión de cuentas y el estado de las unidades.' },
    { objetivo: '[data-guia="u-lista"]', titulo: 'Roles y acceso', texto: 'Asigna el rol de cada persona o desactiva su cuenta. Los cambios aplican en su siguiente ingreso.' },
    { objetivo: '[data-guia="u-roles"]', titulo: 'Qué puede hacer cada rol', texto: 'Administrador, jefe de operaciones y despachador ven secciones distintas del sistema.' },
  ],
};
