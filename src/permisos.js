import { ACT } from './datos/fuente.js';

const MATRIZ = {
  administrador: ['panel', 'programacion', 'aprobar', 'registrar', 'simulador', 'demanda', 'pronostico', 'proxima', 'carga', 'parametros', 'usuarios'],
  jefe_operaciones: ['panel', 'programacion', 'aprobar', 'registrar', 'simulador', 'demanda', 'pronostico', 'proxima', 'carga', 'parametros'],
  despachador: ['panel', 'programacion', 'registrar', 'simulador', 'proxima'],
};

export const puede = (accion) => (MATRIZ[ACT.usuario?.rol] || []).includes(accion);
