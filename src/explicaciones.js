import { S, cal } from './estado.js';
import { fmt } from './lib/formato.js';

const T = () => S.res.total;
const dia = () => S.res.dias[S.dia];
const pct = (a, b) => fmt((b / a - 1) * 100, 1);
const comoLeerDelta = '<b>El porcentaje con flecha</b> es la variación dPULSO respecto al manual: (inteligente − manual) ÷ manual. Verde significa que mejora; rojo, que empeora. En ocupación se usan <b>puntos porcentuales (pp)</b>: la resta directa de dos porcentajes.';

export const EXPLICA = {
  kpi_km_vacio: () => ({
    t: 'Km en vacío',
    b: [
      ['Qué es', `Kilómetros que recorren los buses que salen con menos del ${fmt(S.params.ocupacion_minima * 100)} % de su capacidad (menos de ${Math.round(S.params.capacidad * S.params.ocupacion_minima)} pasajeros). Es dinero en combustible y desgaste que casi no transporta a nadie.`],
      ['Cómo se calcula', 'Salidas con ocupación bajo el umbral × 42 km (ida y vuelta de la ruta).'],
      ['Cómo leerlo', `Horario base: ${fmt(T().manual.km_vacio)} km. PULSO: ${fmt(T().inteligente.km_vacio)} km. El sistema recorre ${pct(T().manual.km_vacio, T().inteligente.km_vacio)} % de km en vacío respecto al horario base. ${comoLeerDelta}`],
    ],
    frase: 'Con el horario base salen buses casi vacíos en horas de poca demanda; el sistema los espacia y ahorra esos kilómetros.',
  }),
  kpi_espera: () => ({
    t: 'Espera promedio',
    b: [
      ['Qué es', 'Minutos que, en promedio, espera un pasajero en el terminal desde que llega hasta que sube a un bus.'],
      ['Por qué cambia', 'Si los buses salen muy espaciados en hora punta, la cola crece y los que no alcanzan sitio esperan al siguiente bus. El sistema saca más buses justo cuando llega más gente.'],
      ['Cómo leerlo', `Horario base: ${fmt(T().manual.espera_prom, 1)} min. PULSO: ${fmt(T().inteligente.espera_prom, 1)} min. ${comoLeerDelta}`],
    ],
    frase: 'Aunque el sistema hace menos salidas en total, las pone donde hacen falta, y por eso la gente espera menos.',
  }),
  kpi_espera_larga: () => ({
    t: `Pasajeros que esperan más de ${S.params.espera_maxima} min`,
    b: [
      ['Qué es', `Porcentaje de pasajeros cuya espera supera el límite de servicio (${S.params.espera_maxima} min, configurable en Parámetros).`],
      ['Por qué importa', 'Es el indicador de calidad que más percibe el usuario: las esperas largas son las que generan quejas.'],
      ['Cómo leerlo', 'La variación está en puntos porcentuales (pp): es la resta directa de ambos porcentajes.'],
    ],
    frase: 'Con el horario base, más de uno de cada diez pasajeros espera demasiado; con el sistema, prácticamente nadie.',
  }),
  kpi_ocupacion: () => ({
    t: 'Ocupación promedio',
    b: [
      ['Qué es', 'En promedio, qué porcentaje de las plazas del bus va ocupado al salir del terminal.'],
      ['Cómo leerlo', 'Más alto es mejor, hasta cierto punto: un bus al 100 % va incómodo. El sistema apunta al 80 % (ocupación objetivo).'],
      ['Puntos porcentuales', `Pasar de ${fmt(T().manual.ocupacion_prom * 100, 1)} % a ${fmt(T().inteligente.ocupacion_prom * 100, 1)} % es +${fmt((T().inteligente.ocupacion_prom - T().manual.ocupacion_prom) * 100, 1)} pp.`],
    ],
    frase: 'Cada bus que sale lleva más pasajeros: la flota se usa mejor.',
  }),
  kpi_km: () => ({
    t: 'Kilómetros recorridos',
    b: [
      ['Qué es', 'Total de kilómetros de todas las salidas: número de salidas × 42 km.'],
      ['Cómo leerlo', `Horario base: ${fmt(T().manual.salidas)} salidas. PULSO: ${fmt(T().inteligente.salidas)} salidas. Menos kilómetros con mejor servicio significa que se quitaron salidas que no hacían falta.`],
    ],
    frase: 'Hacemos menos viajes, pero mejor repartidos.',
  }),
  kpi_combustible: () => ({
    t: 'Combustible estimado',
    b: [
      ['Qué es', 'Costo del diésel de todos los kilómetros recorridos.'],
      ['Supuestos', 'Bus urbano de 12 m: 0,40 litros por km a S/ 4,20 por litro. Son valores referenciales y se reemplazan por los de la empresa.'],
      ['Emisiones', `La diferencia equivale a ${fmt((T().manual.co2_kg - T().inteligente.co2_kg) / 1000, 1)} toneladas de CO₂ menos (2,68 kg por litro).`],
    ],
    frase: 'El ahorro de kilómetros se traduce directamente en combustible y emisiones.',
  }),
  oferta: () => ({
    t: 'Plazas ofrecidas frente a pasajeros',
    b: [
      ['Barras grises: pasajeros', 'Cuántas personas llegaron al terminal en cada intervalo de 15 minutos (la demanda real).'],
      ['Líneas: oferta', 'Cuántas plazas se ofrecieron en ese intervalo: número de buses que salieron × 85 plazas. Azul es el horario base; ámbar, PULSO.'],
      ['Cómo leerlo', 'Lo ideal es que la línea vaya un poco por encima de las barras. La línea azul es plana: ofrece lo mismo aunque cambie la demanda (le sobra en el valle y le falta en la punta). La ámbar sube y baja siguiendo a los pasajeros.'],
    ],
    frase: 'El horario base no sabe cuánta gente viene; el sistema sí, y ajusta la oferta.',
  }),
  espera_dia: () => ({
    t: 'Espera promedio por día',
    b: [
      ['Qué muestra', 'Los minutos de espera promedio de cada día de la semana con cada esquema.'],
      ['Por qué cambia tanto el manual', 'El horario base es igual todos los días laborables, pero la demanda no: los lunes y viernes llega más gente y la tabla se queda corta en hora punta. El inteligente se mantiene estable porque se adapta a cada día.'],
      ['Ejemplo', `${cal.largo(dia().fecha)}: manual ${fmt(dia().manual.espera_prom, 2)} min, inteligente ${fmt(dia().inteligente.espera_prom, 2)} min.`],
    ],
    frase: 'El sistema da un servicio parejo todos los días; el horario base depende de la suerte.',
  }),

  pron_principal: () => ({
    t: 'Demanda real y pronosticada',
    b: [
      ['Barras grises: lo que pasó', 'Pasajeros que realmente llegaron en cada intervalo de 15 min.'],
      ['Línea verde: pronóstico del modelo (Prophet)', 'Lo que el modelo estimó antes de que ocurriera, usando solo el historial.'],
      ['Franja verde: margen probable', 'Margen de incertidumbre: el modelo espera que la demanda real caiga dentro de esa franja 8 de cada 10 veces.'],
      ['Línea punteada: método actual (empírico)', 'Lo que haría un despachador sin modelo: el promedio del mismo día y la misma hora de las últimas 4 semanas.'],
      ['Qué es Prophet', 'Un modelo de series de tiempo creado por Meta. Separa la demanda en partes fáciles de entender: una tendencia de largo plazo, un patrón dentro del día, un efecto por día de la semana y los feriados. Luego las combina para proyectar el futuro.'],
    ],
    frase: 'La línea verde es lo que el sistema predijo y las barras lo que pasó: casi se superponen.',
  }),
  error: () => ({
    t: 'Error de pronóstico',
    b: [
      ['MAE', 'Error absoluto medio: en promedio, por cuántos pasajeros se equivoca cada pronóstico en un intervalo. Fácil de explicar.'],
      ['RMSE', 'Parecido, pero castiga más los errores grandes. Importa porque un error grande en hora punta deja gente sin bus.'],
      ['MAPE', 'El error en porcentaje respecto a lo real (solo intervalos con 20 o más pasajeros).'],
      ['Cómo leerlo', 'En los tres, menor es mejor. Las barras comparan los dos métodos: la más corta gana.'],
    ],
    frase: 'Prophet se equivoca menos que el método empírico en las tres medidas.',
  }),
  patron_diario: () => ({
    t: 'Patrón diario (multiplicador)',
    b: [
      ['Qué es', 'Cómo cambia la demanda a lo largo del día respecto al nivel base (la tendencia).'],
      ['Cómo leer el multiplicador', 'La línea discontinua ×1 es el nivel base. ×2,5 significa que a esa hora llega 2,5 veces más gente que el promedio; ×0,3, que llega menos de un tercio.'],
      ['Por qué hay tres curvas', 'Un día laborable tiene dos horas punta (ir y volver del trabajo); el sábado es más plano; el domingo y los feriados son bajos todo el día. El modelo aprende una curva distinta para cada uno.'],
    ],
    frase: 'A las 7 de la mañana de un día laborable llega casi el triple de pasajeros que el promedio del día.',
  }),
  efecto_semana: () => ({
    t: 'Efecto del día de la semana',
    b: [
      ['Qué es', 'Un ajuste adicional que el modelo aprende para cada día, además del patrón diario.'],
      ['Cómo leerlo', '+5 % significa que ese día viene un 5 % más de gente de lo que diría solo el patrón; −5 %, menos.'],
      ['Nota', 'Se combina con el patrón diario, por eso no hay que leerlo solo: el sábado aparece alto porque su patrón diario ya es bajo y este efecto lo corrige.'],
    ],
    frase: 'Los viernes vienen más pasajeros que los martes, y el modelo lo tiene en cuenta.',
  }),
  tendencia: () => ({
    t: 'Tendencia',
    b: [
      ['Qué es', 'El nivel base de pasajeros por intervalo, sin los altibajos del día ni de la semana.'],
      ['Cómo leerlo', 'Si sube, la ruta gana usuarios; si baja, los pierde. La caída de julio y agosto corresponde a las vacaciones escolares.'],
    ],
    frase: 'La tendencia permite ver si la ruta crece mes a mes.',
  }),

  fut_estado: () => ({
    t: 'Estado de los datos',
    b: [
      ['Qué es', 'Indica hasta qué día hay registros cargados y si el pronóstico sigue siendo confiable.'],
      ['Al día', 'El último registro tiene una semana o menos.'],
      ['Conviene actualizar', 'Pasaron entre 8 y 14 días: el pronóstico aún sirve, pero ya no incluye lo más reciente.'],
      ['Desactualizados', 'Más de dos semanas sin datos nuevos: el modelo no ve cambios recientes (obras, temporada, nuevas rutas).'],
    ],
    frase: 'El sistema avisa cuándo hay que cargar datos nuevos para que el pronóstico no envejezca.',
  }),
  fut_dias: () => ({
    t: 'La semana que viene',
    b: [
      ['Qué es', 'Los siete días siguientes al último registro. Para estos días todavía no hay datos reales: todo es pronóstico.'],
      ['Personas', 'Total de pasajeros que el modelo espera ese día, entre las 05:00 y las 23:00.'],
      ['Salidas', 'Cuántos buses dejó programados el sistema para atender esa demanda.'],
    ],
    frase: 'El sistema no necesita datos del futuro: proyecta los patrones del historial, como un pronóstico del clima.',
  }),
  fut_detalle: () => ({
    t: 'Pronóstico del día',
    b: [
      ['Línea verde', 'Cuántas personas se espera que lleguen en cada cuarto de hora.'],
      ['Franja', 'El margen probable: la cantidad real debería caer dentro de esa franja 8 de cada 10 veces.'],
      ['Sin barras', 'No hay barras de “lo que pasó” porque ese día todavía no ocurre.'],
    ],
    frase: 'Esto es lo que esperamos que pase el próximo lunes, hora por hora.',
  }),
  fut_plan: () => ({
    t: 'Programación preparada',
    b: [
      ['Qué es', 'El plan de salidas que el sistema deja listo para ese día, calculado solo con el pronóstico.'],
      ['Espera y pasajeros por bus', 'Son estimaciones suponiendo que llega exactamente la gente pronosticada.'],
      ['El día de la operación', 'Si llega más o menos gente, la corrección en vivo ajusta las salidas cada 15 minutos (ver la sección En vivo).'],
    ],
    frase: 'El despachador empieza la semana con el plan ya hecho.',
  }),
  fut_ciclo: () => ({
    t: 'Ciclo de actualización',
    b: [
      ['Cada cuánto', 'Una vez por semana es suficiente. Con conteo en tiempo real, la corrección del día ocurre sola.'],
      ['Qué pasa con los datos anteriores', 'Se conservan. Los nuevos se agregan al final del historial; si un cuarto de hora ya existía (por ejemplo, una corrección de la empresa), se reemplaza por el valor más reciente.'],
      ['Por qué no borrar', 'Mientras más historial tenga, mejor aprende el modelo los patrones de feriados, vacaciones y temporadas.'],
      ['Dónde vive', 'Hoy en un archivo CSV acumulado. En la siguiente etapa, en una base de datos (por ejemplo Supabase) con la fecha y hora como clave única.'],
    ],
    frase: 'Cada lunes se cargan los registros de la semana y el sistema vuelve a aprender y a programar.',
  }),

  pizarra: () => ({
    t: 'Próximas salidas',
    b: [
      ['Qué es', 'El tablero que vería el personal del terminal: la última salida y las que vienen, con la unidad asignada y el andén.'],
      ['Estado', '<b>Salió</b>: ya partió. <b>Abordando</b>: sale en menos de 2 minutos. <b>En N min</b>: programada.'],
      ['Carga', 'Cuán lleno se espera que salga: ligera (menos del 60 %), media o llena (90 % o más).'],
      ['Hora', 'Si el día elegido es hoy, el tablero sigue la hora real y se actualiza solo. Para otros días muestra la hora punta de la mañana.'],
    ],
    frase: 'Esto es lo que el despachador tendría en pantalla: quién sale, cuándo y por qué andén.',
  }),
  prog_kpis: () => ({
    t: 'Resumen del día',
    b: [
      ['Salidas programadas', 'Cuántos buses salen del terminal en el día con PULSO, frente al horario base.'],
      ['Primera y última', 'Horas de la primera y de la última salida.'],
      ['Intervalo', 'El intervalo más corto (hora punta) y el más largo (poca demanda) entre dos salidas.'],
      ['Unidades en servicio', 'Cuántos buses distintos de la flota se usaron.'],
    ],
    frase: 'El sistema arma el día completo sin que nadie calcule a mano.',
  }),
  headway: () => ({
    t: 'Minutos entre salidas',
    b: [
      ['Qué es', 'Cada cuántos minutos sale un bus, a lo largo del día. Menos minutos = más buses.'],
      ['Línea azul (manual)', 'Intervalos fijos de la tabla: por ejemplo, cada 4 min en punta y cada 6 min en el valle, sin importar cuánta gente llegue.'],
      ['Línea ámbar (inteligente)', 'El intervalo que calcula el sistema según el pronóstico. Si en punta baja a 2,6 min es porque llega tanta gente que un bus se llena en ese tiempo.'],
      ['Línea discontinua', `La espera máxima (${S.params.espera_maxima} min): el sistema nunca deja pasar más que eso entre dos buses, aunque haya poca gente.`],
      ['Barras de abajo', 'Cada marca es una salida. Donde se amontonan, salen muchos buses seguidos.'],
    ],
    frase: 'El horario base es un escalón rígido; el sistema dibuja una curva que sigue a los pasajeros.',
  }),
  cronograma: () => ({
    t: 'Cronograma generado',
    b: [
      ['Columnas', '<b>Salida</b>: hora del despacho. <b>Unidad</b>: bus asignado (el que lleva más tiempo esperando en el terminal). <b>Intervalo</b>: minutos hasta el siguiente bus. <b>Demanda de diseño</b>: pasajeros previstos en ese cuarto de hora, ya con la corrección en vivo. <b>Ocupación</b>: carga con la que salió en la simulación.'],
      ['Regla aplicada', '<b>Capacidad</b>: sale cuando se junta la carga objetivo. <b>Espera máx.</b>: hay poca gente y sale por el tope de minutos. <b>Andén</b>: se llegó al mínimo físico entre salidas. <b>Flota</b>: no había bus libre y se esperó el retorno de uno.'],
      ['Franjas', '<b>05–06 h</b>: inicio de operación. <b>Punta mañana</b> (06–09): ida al trabajo y estudios. <b>Valle</b> (09–16): demanda baja y estable. <b>Punta tarde</b> (16–20): regreso a casa. <b>Noche</b> (20–23): cierre.'],
      ['Ajuste en vivo', 'Cuánto se corrigió el pronóstico porque llegó más (+) o menos (−) gente de lo previsto.'],
    ],
    frase: 'Cada salida tiene una razón explícita; el despachador puede ver por qué el sistema decidió así.',
  }),

  vivo_control: () => ({
    t: 'Reloj y reproducción',
    b: [
      ['Reproducir', 'Avanza el día simulado. ×30 = 30 minutos simulados por cada minuto real; ×60 = una hora por minuto; ×180 = tres horas por minuto.'],
      ['En directo', 'Solo con el día de hoy elegido: el reloj sigue la hora de tu computadora y muestra lo que estaría pasando ahora mismo en la operación.'],
      ['Barra', 'Arrástrala para saltar a cualquier hora del día.'],
    ],
    frase: 'Podemos ver la operación de todo el día en minutos, o seguirla en tiempo real.',
  }),
  corredor: () => ({
    t: 'Corredor: manual frente a inteligente',
    b: [
      ['Qué es', 'La ruta dibujada de Terminal Norte a Terminal Sur, con sus paraderos. Arriba los buses del despacho manual; abajo, los del sistema. Ambos atienden exactamente a los mismos pasajeros.'],
      ['Los rectángulos', 'Cada uno es un bus. En la vía superior va de ida (más intenso); en la inferior regresa (más tenue).'],
      ['Qué aporta', 'Permite ver la diferencia: en el valle el horario base tiene muchos buses en ruta casi vacíos; en la punta el sistema pone más buses justo cuando la cola crece.'],
      ['Qué no muestra', 'Es una simulación de tiempos medios: no incluye tráfico ni paradas reales de cada paradero.'],
    ],
    frase: 'Arribal horario base, abajo el sistema: mismo día, mismos pasajeros, distinta distribución de buses.',
  }),
  imprevisto: () => ({
    t: 'Simular imprevisto',
    b: [
      ['Qué hace', 'Sube la demanda real del día elegido en la franja que indiques (por ejemplo, +40 % de 17:00 a 19:30), como pasaría con lluvia, el cierre de una vía alterna o un evento masivo.'],
      ['Qué NO cambia', 'El pronóstico. El modelo no lo podía saber de antemano: es una sorpresa.'],
      ['Cómo reacciona cada esquema', 'El horario base sigue igual y la cola crece. El sistema compara cada 15 minutos lo que llega con lo que esperaba; al ver la diferencia, corrige su estimación y adelanta salidas.'],
      ['Dónde se nota', 'En la cola del terminal, en la bitácora, en el día marcado con un punto rojo y en los indicadores de Resumen.'],
    ],
    frase: 'Provoquemos un imprevisto: el horario base no reacciona; el sistema detecta la diferencia y corrige en minutos.',
  }),
  cola: () => ({
    t: 'Pasajeros esperando',
    b: [
      ['Barras', 'Cuántas personas hay en la cola del terminal en este minuto, con cada esquema.'],
      ['Buses en ruta', 'Cuántas unidades están circulando (ida o vuelta) en este momento.'],
      ['Próxima salida', 'Hora del siguiente bus del sistema.'],
      ['Intervalo vigente', 'Minutos entre la salida anterior y la siguiente.'],
      ['Ajuste en vivo', 'Cuánto está corrigiendo el pronóstico: +10 % significa que está llegando un 10 % más de gente de la prevista.'],
      ['Regla', 'Qué regla decidió la última salida (capacidad, espera máxima, andén o flota).'],
    ],
    frase: 'Con la misma gente llegando, la cola del sistema se mantiene corta.',
  }),
  vivo_demanda: () => ({
    t: 'Demanda del día',
    b: [
      ['Línea verde', 'El pronóstico de Prophet para todo el día.'],
      ['Barras', 'Lo que va llegando realmente, hasta la hora del reloj (la línea vertical).'],
      ['Zona rayada', 'Franja del imprevisto, si está activo. Ahí las barras superan a la línea y el sistema empieza a corregir.'],
    ],
    frase: 'Vemos en vivo si la realidad sigue al pronóstico.',
  }),
  bitacora: () => ({
    t: 'Bitácora del sistema',
    b: [
      ['Qué es', 'El registro de las decisiones del sistema, del más reciente al más antiguo.'],
      ['Tipos', '<b>Hora punta / baja demanda</b>: el sistema cambia de regla porque cambió la cantidad de gente. <b>Llegan más/menos pasajeros</b>: activó la corrección en vivo. <b>Vuelve a lo previsto</b>: retiró la corrección. <b>Imprevisto</b>: inicio y fin del evento simulado.'],
    ],
    frase: 'El sistema deja constancia de cada decisión y su motivo.',
  }),

  p_flota: () => ({
    t: 'Unidad y flota',
    b: [
      ['Capacidad por bus', 'Cuántos pasajeros entran en un bus (sentados y de pie). Con buses más grandes hacen falta menos salidas.'],
      ['Flota disponible', 'Cuántos buses hay para la ruta. Si es poca, en hora punta no habrá bus libre y la regla “Flota” retrasará salidas.'],
    ],
    frase: 'Si mañana hay 5 buses en mantenimiento, se cambia aquí y el sistema reprograma.',
  }),
  p_servicio: () => ({
    t: 'Nivel de servicio',
    b: [
      ['Ocupación objetivo', 'Con cuánta carga conviene que salga cada bus. 80 % deja algo de espacio para los que suben en los paraderos.'],
      ['Umbral de salida en vacío', 'Debajo de esta carga, la salida se cuenta como kilometraje en vacío.'],
      ['Espera máxima', 'El tope de minutos entre dos buses. Tiene prioridad sobre la ocupación: aunque venga poca gente, nunca se espera más que esto.'],
      ['Intervalo mínimo de andén', 'Lo mínimo que físicamente puede pasar entre dos salidas en el terminal.'],
    ],
    frase: 'Son las políticas de servicio de la empresa, traducidas a números.',
  }),
  p_intel: () => ({
    t: 'Inteligencia',
    b: [
      ['Margen sobre el pronóstico', 'Un colchón de seguridad. ×1,05 significa que el sistema planifica como si fueran a llegar un 5 % más de pasajeros de los pronosticados, para absorber el error del modelo.'],
      ['Umbral de corrección', 'Cuánta diferencia entre lo real y lo pronosticado hace falta para que el sistema corrija en vivo. 12 % evita reaccionar a variaciones pequeñas.'],
      ['Corrección en tiempo real', 'Si se apaga, el sistema solo sigue el pronóstico. Sirve para mostrar cuánto aporta la adaptación ante imprevistos.'],
    ],
    frase: 'Aquí se regula cuánto confía el sistema en el modelo y cuánto en lo que ve en vivo.',
  }),
  p_logica: () => ({
    t: 'Lógica aplicada',
    b: [
      ['Paso 1', 'D es la demanda de diseño: el pronóstico por el factor de corrección en vivo.'],
      ['Paso 2', 'El intervalo es el tiempo que tarda en juntarse la carga objetivo. Ejemplo: si llegan 20 pasajeros por minuto y se quiere salir con 68 (85 × 0,80), el bus sale cada 3,2 min.'],
      ['Pasos 3 y 4', 'Ese intervalo se recorta al máximo (espera máxima) y al mínimo (andén).'],
      ['Paso 5', 'Si todos los buses están en ruta, se espera al primero que vuelva.'],
      ['Paso 6', 'Cada 15 minutos se compara lo real con lo pronosticado y, si difiere más del umbral, se corrige D.'],
    ],
    frase: 'Son seis reglas simples que se aplican en cada salida, en milisegundos.',
  }),
  p_resultado: () => ({
    t: 'Resultado de la semana',
    b: [
      ['Qué es', 'Los mismos indicadores del Resumen, recalculados con los parámetros que pusiste.'],
      ['Número grande', 'El resultado dPULSO.'],
      ['Horario base', 'El resultado del horario base con la misma flota y la misma demanda.'],
      ['Porcentaje', '(inteligente − manual) ÷ manual. Verde mejora, rojo empeora. Ocupación y “esperan más de…” se comparan en puntos porcentuales.'],
    ],
    frase: 'Movemos una regla y en una fracción de segundo vemos el efecto en toda la semana.',
  }),

  calor: () => ({
    t: 'Afluencia por día y hora',
    b: [
      ['Qué es', 'Un mapa de calor: cada fila es un día de la semana y cada columna una hora. El color indica cuántos pasajeros llegan, en promedio, en esa hora.'],
      ['Cómo leerlo', 'Más intenso = más pasajeros. Pasa el cursor por una celda para ver el número exacto.'],
      ['Qué se ve', 'De lunes a viernes, dos franjas intensas (07:00 y 18:00): las horas punta. Sábado más parejo. Domingo claro todo el día.'],
    ],
    frase: 'Este mapa resume seis meses de datos: muestra cuándo se concentra la gente.',
  }),
  ficha: () => ({
    t: 'Ficha del conjunto de datos',
    b: [
      ['Qué es', 'Las características del historial con el que se entrena el modelo.'],
      ['Faltantes', 'Intervalos sin registro (por ejemplo, una falla de la máquina de boletos). Prophet los tolera sin necesidad de rellenarlos.'],
      ['Estructura de entrada', 'El formato que deben tener los datos reales: una fila por cada 15 minutos con la fecha y hora, los pasajeros y el tipo de día.'],
    ],
    frase: 'Con datos reales en este formato, el sistema se recalibra solo.',
  }),
  diario: () => ({
    t: 'Pasajeros por día',
    b: [
      ['Qué es', 'El total de pasajeros de cada día del historial.'],
      ['Cómo leerlo', 'Los dientes de sierra son la semana: sube de lunes a viernes y baja el fin de semana. Los puntos rojos son feriados nacionales, con demanda parecida a un domingo.'],
    ],
    frase: 'Se ve el ritmo semanal y el efecto de los feriados.',
  }),
};

export function contenidoInfo(clave) {
  const f = EXPLICA[clave];
  if (!f) return null;
  try { return f(); } catch { return null; }
}
