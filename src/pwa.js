export const INSTALAR = { evento: null, oyentes: new Set() };
const avisar = () => INSTALAR.oyentes.forEach((f) => f());

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); INSTALAR.evento = e; avisar(); });
addEventListener('appinstalled', () => { INSTALAR.evento = null; avisar(); });

export const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function instalar() {
  if (!INSTALAR.evento) return false;
  INSTALAR.evento.prompt();
  const r = await INSTALAR.evento.userChoice;
  INSTALAR.evento = null; avisar();
  return r.outcome === 'accepted';
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
