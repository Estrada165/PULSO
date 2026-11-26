import { readFileSync } from 'node:fs';
import { crearMotor } from '../src/motor/despacho.js';

const D = JSON.parse(readFileSync(new URL('../src/data/datos.json', import.meta.url)));
const M = crearMotor(D);
const r = M.semana(D.params);
let ok = true;
for (const e of ['manual', 'inteligente']) {
  for (const [k, py] of Object.entries(D.referencia_python[e])) {
    const js = r.total[e][k];
    const dif = Math.abs(js - py) / Math.max(1, Math.abs(py));
    const estado = dif < 0.002 ? 'OK ' : 'DIF';
    if (dif >= 0.002) ok = false;
    console.log(`${estado} ${e.padEnd(12)} ${k.padEnd(18)} python=${py.toFixed(3).padStart(12)} js=${js.toFixed(3).padStart(12)}`);
  }
}
console.log(ok ? '\nEl motor JS coincide con el motor Python.' : '\nHay diferencias: revisar.');
process.exit(ok ? 0 : 1);
