import { obtenerCategorias } from './categorias.js';
import { montarPagina, desmontarPagina } from './pagina.js';
import { sesion, fetchConToken, notificar, limpiarSesion } from './comun.js';

const base = '/frontend/';
const rutas = new Map([
  ['/index.html', { grupo: 'acceso', modulo: 'auth/js/experiencia.js' }],
  [`${base}auth/login.html`, { grupo: 'acceso', modulo: 'auth/js/autenticacion.js' }],
  [`${base}auth/register.html`, { grupo: 'acceso', modulo: 'auth/js/autenticacion.js' }],
  [`${base}usuario/productos.html`, { grupo: 'tienda', modulo: 'usuario/js/catalogo.js', datos: ['libros'] }],
  [`${base}usuario/historial.html`, { grupo: 'tienda', modulo: 'usuario/js/historial.js', datos: ['mis-compras'], privada: true }],
  [`${base}usuario/contacto.html`, { grupo: 'tienda', modulo: 'usuario/js/contacto.js' }],
  [`${base}usuario/carrito.html`, { grupo: 'tienda', modulo: 'usuario/js/carrito.js' }],
  [`${base}admin/admin.html`, { grupo: 'admin', modulo: 'admin/js/libros.js', datos: ['libros'] }],
  [`${base}admin/ventas.html`, { grupo: 'admin', modulo: 'admin/js/ventas.js', datos: ['ventas'], privada: true }],
  [`${base}admin/usuarios.html`, { grupo: 'admin', modulo: 'admin/js/usuarios.js', datos: ['usuarios', 'roles'], privada: true }]
]);
const reducida = matchMedia('(prefers-reduced-motion: reduce)');
const documentos = new Map();
const estados = new Map();
let actual = location.pathname === '/' ? '/index.html' : location.pathname;
let indice = history.state?.bibliotrack ?? 0;
let solicitud = 0;
let pendiente;
let transicion;
let fallback;
let marcada = [];

history.replaceState({ ...history.state, bibliotrack: indice }, '', location.href);
history.scrollRestoration = 'manual';

function rutaLocal(value) {
  const url = new URL(value, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname === '/') url.pathname = '/index.html';
  return rutas.has(url.pathname) ? url : null;
}

function guardarEstado() {
  const campos = {};
  document.querySelectorAll('main input[id], main select[id], main textarea[id]').forEach(el => {
    if (['password', 'file', 'hidden'].includes(el.type) || el.closest('.form-box')) return;
    campos[el.id] = el.value;
  });
  estados.set(indice, {
    campos, x: scrollX, y: scrollY,
    categoria: document.querySelector('#category-pills-container .active')?.dataset.category,
    periodo: document.querySelector('[data-period].active')?.dataset.period,
    pagina: Number(document.querySelector('#sales-table-body')?.dataset.page || 0)
  });
  if (estados.size > 40) estados.delete(estados.keys().next().value);
}

function restaurarEstado(estado, url) {
  for (const [id, value] of Object.entries(estado?.campos || {})) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }
  if (estado?.categoria) document.querySelector(`[data-category="${Number(estado.categoria)}"]`)?.click();
  if (estado?.periodo) [...document.querySelectorAll('[data-period]')].find(el => el.dataset.period === estado.periodo)?.click();
  for (let page = 0; page < (estado?.pagina || 0); page++) document.getElementById('report-next')?.click();
  const main = document.querySelector('main');
  main?.setAttribute('tabindex', '-1');
  main?.setAttribute('data-route-focus', '');
  main?.focus({ preventScroll: true });
  if (url.hash) {
    let target;
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch {}
    target?.scrollIntoView({ behavior: 'instant' });
  } else scrollTo({ left: estado?.x || 0, top: estado?.y || 0, behavior: 'instant' });
}

async function cargarDocumento(url) {
  const key = url.pathname;
  if (!documentos.has(key)) {
    const promise = fetch(key, { signal: AbortSignal.timeout(10000) }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Página no disponible');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!doc.querySelector('main')) throw new Error('Página incompleta');
      return doc;
    }).catch(error => { documentos.delete(key); throw error; });
    documentos.set(key, promise);
  }
  return (await documentos.get(key)).cloneNode(true);
}

async function prepararEstilos(doc) {
  const presentes = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(el => el.href));
  await Promise.all([...doc.querySelectorAll('link[rel="stylesheet"]')].map(link => {
    const href = new URL(link.getAttribute('href'), location.origin).href;
    if (presentes.has(href)) return;
    return new Promise((resolve, reject) => {
      const nuevo = document.createElement('link');
      nuevo.rel = 'stylesheet'; nuevo.href = href;
      const timer = setTimeout(() => { nuevo.remove(); reject(new Error('No se pudo cargar el estilo')); }, 10000);
      nuevo.onload = () => { clearTimeout(timer); resolve(); };
      nuevo.onerror = () => { clearTimeout(timer); nuevo.remove(); reject(new Error('No se pudo cargar el estilo')); };
      document.head.appendChild(nuevo);
    });
  }));
}

async function prepararDatos(ruta, signal) {
  const resultados = await Promise.all((ruta.datos || []).map(async nombre => {
    const url = `${location.origin}/api/${nombre}`;
    try {
      const response = await fetchConToken(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
      const body = await response.text();
      return [url, new Response(body, { status: response.status, headers: response.headers })];
    } catch (error) { return [url, error]; }
  }));
  return new Map(resultados);
}

function desmarcar() {
  marcada.forEach(el => { el.style.viewTransitionName = ''; });
  marcada = [];
}

function marcar(tipo) {
  desmarcar();
  const elementos = tipo === 'acceso'
    ? [['.access-header', 'route-header'], ['.access-visual', 'route-visual'], ['.access-content', 'route-main']]
    : [['.main-navbar, .access-header', 'route-header'], ['main', 'route-main'], ['.navbar-links .active', 'route-tab']];
  for (const [selector, nombre] of elementos) {
    const el = document.querySelector(selector);
    if (el && el.getClientRects().length) { el.style.viewTransitionName = nombre; marcada.push(el); }
  }
}

function terminarTransicion() {
  transicion?.skipTransition();
  fallback?.cancel();
  desmarcar();
  delete document.documentElement.dataset.routeTransition;
  delete document.documentElement.dataset.routeDirection;
}
window.biblioCancelTransition = terminarTransicion;

export async function navegar(value, opciones = {}) {
  let url = rutaLocal(value);
  if (!url) { location.assign(value); return; }
  let ruta = rutas.get(url.pathname);
  if (ruta.grupo === 'admin' && !sesion.esAdmin) {
    url = new URL(`${base}auth/login.html`, location.origin);
    ruta = rutas.get(url.pathname);
  }
  if (ruta.privada && !sesion.id) { location.assign(`${base}auth/login.html`); return; }
  if (url.searchParams.get('modo') === 'invitado') {
    if (sesion.id) { location.assign(url); return; }
    url.searchParams.delete('modo');
  }
  if (!opciones.historial && url.pathname === actual && url.search === location.search) {
    pendiente?.abort(); ++solicitud; terminarTransicion();
    if (url.hash && url.hash !== location.hash) {
      guardarEstado();
      history.pushState({ bibliotrack: ++indice }, '', url);
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      target?.scrollIntoView();
      target?.focus({ preventScroll: true });
    }
    return;
  }
  const request = ++solicitud;
  pendiente?.abort();
  pendiente = new AbortController();
  const signal = pendiente.signal;
  terminarTransicion();
  const anterior = rutas.get(actual);
  const tipo = anterior?.grupo === 'acceso' && ruta.grupo === 'acceso' ? 'acceso'
    : anterior?.grupo === 'acceso' || ruta.grupo === 'acceso' ? 'portada' : 'pagina';
  const destinoIndice = opciones.historial ? opciones.indice : indice + 1;
  const atras = opciones.historial ? destinoIndice < indice
    : tipo === 'acceso' && [...rutas.keys()].indexOf(url.pathname) < [...rutas.keys()].indexOf(actual);
  const enlace = opciones.enlace;
  enlace?.setAttribute('aria-busy', 'true');
  try {
    const [doc, datos] = await Promise.all([
      cargarDocumento(url), prepararDatos(ruta, signal),
      import(`${base}${ruta.modulo}`),
      ruta.datos?.includes('libros') ? obtenerCategorias().catch(() => {}) : Promise.resolve()
    ]);
    await prepararEstilos(doc);
    if (signal.aborted || request !== solicitud) return;
    if (ruta.privada && [...datos.values()].some(response => response?.status === 401)) {
      limpiarSesion(); location.replace(`${base}auth/login.html`); return;
    }
    guardarEstado();
    const estado = opciones.historial ? estados.get(destinoIndice) : null;
    const actualizar = async () => {
      if (request !== solicitud) return;
      desmontarPagina();
      doc.querySelectorAll('script').forEach(el => el.remove());
      document.body.className = doc.body.className;
      document.body.style.cssText = doc.body.style.cssText;
      document.body.replaceChildren(...doc.body.childNodes);
      document.title = doc.title;
      document.documentElement.toggleAttribute('data-admin-page', ruta.grupo === 'admin');
      document.documentElement.classList.remove('admin-locked');
      if (opciones.historial) history.replaceState({ ...history.state, bibliotrack: destinoIndice }, '', url);
      else history.pushState({ bibliotrack: destinoIndice }, '', url);
      indice = destinoIndice; actual = url.pathname;
      await montarPagina(datos, estado || {});
      if (request !== solicitud) return;
      restaurarEstado(estado, url);
      marcar(tipo);
    };
    document.documentElement.dataset.routeTransition = tipo;
    document.documentElement.dataset.routeDirection = atras ? 'back' : 'forward';
    marcar(tipo);
    if (document.startViewTransition && !reducida.matches) {
      const current = document.startViewTransition(actualizar);
      transicion = current;
      current.ready.catch(() => {});
      await current.finished;
    } else {
      await actualizar();
      if (!reducida.matches) {
        const main = document.querySelector(tipo === 'acceso' ? '.access-content' : 'main');
        fallback = main?.animate([
          { opacity: .35, transform: `translate3d(${atras ? -24 : 24}px, 18px, 0)` },
          { opacity: 1, transform: 'none' }
        ], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
        await fallback?.finished.catch(() => {});
      }
    }
  } catch (error) {
    if (signal.aborted || request !== solicitud) return;
    if (opciones.historial) { location.reload(); return; }
    notificar('No pudimos abrir la página. Revisa tu conexión y vuelve a intentarlo.');
    console.warn('Navegación no completada:', error.message);
  } finally {
    enlace?.removeAttribute('aria-busy');
    if (request === solicitud) terminarTransicion();
  }
}
window.biblioNavigate = navegar;

document.addEventListener('click', event => {
  const enlace = event.target.closest('a[href]');
  if (!enlace || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || enlace.hasAttribute('download') || (enlace.target && enlace.target !== '_self') || enlace.hasAttribute('data-full-navigation')) return;
  const url = rutaLocal(enlace.href);
  if (!url) return;
  event.preventDefault();
  navegar(url, { enlace });
});

for (const evento of ['pointerover', 'focusin']) document.addEventListener(evento, event => {
  const enlace = event.target.closest('a[href]');
  const url = enlace && rutaLocal(enlace.href);
  if (!url || url.pathname === actual || (rutas.get(url.pathname).grupo === 'admin' && !sesion.esAdmin)) return;
  if (navigator.connection?.saveData) return;
  cargarDocumento(url).catch(() => {});
}, { passive: true });

window.addEventListener('popstate', event => {
  if (event.state?.bibliotrack == null) { location.reload(); return; }
  navegar(location.href, { historial: true, indice: event.state.bibliotrack });
});
reducida.addEventListener('change', event => { if (event.matches) terminarTransicion(); });
