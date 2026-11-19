const inicializadores = [];
let controlador;

export function alMontarPagina(selector, iniciar) {
  inicializadores.push({ selector, iniciar });
}

export function desmontarPagina() {
  controlador?.abort();
}

export async function montarPagina(preparados = new Map(), restaurado = {}) {
  desmontarPagina();
  controlador = new AbortController();
  const signal = controlador.signal;
  const contexto = {
    signal,
    restaurado,
    alSalir: callback => signal.addEventListener('abort', callback, { once: true }),
    fetch: async (url, opciones = {}) => {
      const key = new URL(url, location.href).href;
      if (!opciones.method || opciones.method === 'GET') {
        if (preparados.has(key)) {
          const respuesta = preparados.get(key);
          preparados.delete(key);
          signal.throwIfAborted();
          if (respuesta instanceof Error) throw respuesta;
          return respuesta.clone();
        }
        return fetch(url, { ...opciones, signal });
      }
      return fetch(url, opciones);
    }
  };
  const tareas = inicializadores.filter(({ selector }) => document.querySelector(selector))
    .map(({ iniciar }) => iniciar(contexto));
  document.dispatchEvent(new Event('bibliotrack:mount'));
  await Promise.all(tareas);
}

document.addEventListener('DOMContentLoaded', () => {
  montarPagina().catch(error => console.error('No se pudo inicializar la página.', error));
}, { once: true });
