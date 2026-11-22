import { alMontarPagina } from './pagina.js';
import { actualizarSelectores } from './selectores.js';
import { sesion } from './comun.js';

export const movimientoReducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const moneda = value => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value) || 0);
export const escapar = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function portadaSegura(value) {
  try {
    const url = new URL(value, location.origin);
    if (value && ['http:', 'https:'].includes(url.protocol)) return escapar(url.href);
  } catch {}
  return '/frontend/compartido/imagenes/portada.png';
}

export function animarEntrada(elements, delay = 0) {
  const list = typeof elements === 'string' ? [...document.querySelectorAll(elements)] : [...elements];
  if (document.documentElement.dataset.routeTransition || movimientoReducido() || !window.Motion || !list.length) return;
  window.Motion.animate(list, { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] }, {
    duration: .42, delay: index => delay + Math.min(index, 7) * .045, ease: [.22, 1, .36, 1]
  });
}

const counters = new WeakMap();
export function detenerNumero(element) {
  counters.get(element)?.stop();
  counters.delete(element);
}
export function animarNumero(element, value, format = String) {
  if (!element) return;
  detenerNumero(element);
  const from = Number(element.dataset.value || 0);
  element.dataset.value = String(value);
  if (document.documentElement.dataset.routeTransition || movimientoReducido() || !window.Motion) { element.textContent = format(value); return; }
  counters.set(element, window.Motion.animate(from, value, {
    duration: .55, ease: 'easeOut', onUpdate: number => { element.textContent = format(number); },
    onComplete: () => { element.textContent = format(value); }
  }));
}

let activeModal = null;
let returnFocus = null;
let modalAnimation = null;
let closing = false;
export function abrirModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (activeModal && activeModal !== modal) cerrarModal(activeModal.id, true);
  returnFocus = document.activeElement;
  activeModal = modal;
  closing = false;
  modalAnimation?.stop();
  actualizarSelectores(modal);
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('body > header, body > main, body > footer').forEach(el => { el.inert = true; });
  const card = modal.querySelector('.modal-card');
  if (!movimientoReducido() && window.Motion) {
    modalAnimation = window.Motion.animate(card, { opacity: [0, 1], transform: ['translateY(16px) scale(.97)', 'translateY(0px) scale(1)'] }, { duration: .3, ease: [.22, 1, .36, 1] });
  }
  (modal.querySelector('input:not([type="hidden"]):not([disabled]), button:not([disabled])') || modal).focus({ preventScroll: true });
}
export function cerrarModal(id, instant = false) {
  const modal = document.getElementById(id);
  if (!modal || closing || modal.style.display !== 'flex') return;
  closing = true;
  const finish = () => {
    modal.style.display = 'none';
    modal.style.opacity = '1';
    if (activeModal === modal) activeModal = null;
    document.body.style.overflow = '';
    document.querySelectorAll('body > header, body > main, body > footer').forEach(el => { el.inert = false; });
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    closing = false;
  };
  if (instant || movimientoReducido() || !window.Motion) { finish(); return; }
  modalAnimation = window.Motion.animate(modal, { opacity: [1, 0] }, { duration: .16, ease: 'easeIn', onComplete: finish });
}

alMontarPagina('body', (pagina) => {
  pagina.alSalir(() => {
    modalAnimation?.stop();
    activeModal = null; returnFocus = null; closing = false;
    document.body.style.overflow = '';
    document.querySelectorAll('[data-value]').forEach(detenerNumero);
  });
  animarEntrada('[data-reveal]');
  const greeting = document.getElementById('catalog-greeting');
  if (greeting && sesion.nombre) greeting.textContent = `Tu siguiente historia, ${sesion.nombre.split(' ')[0]}.`;
  document.querySelectorAll('[data-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.password);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', `${show ? 'Ocultar' : 'Mostrar'} contraseña`);
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', event => { if (event.target === modal) cerrarModal(modal.id); });
  });
  document.addEventListener('keydown', event => {
    if (activeModal) {
      if (event.key === 'Escape') { event.preventDefault(); cerrarModal(activeModal.id); }
      if (event.key === 'Tab') {
        const focusable = [...activeModal.querySelectorAll('button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]):not(.biblio-select-original), textarea, a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === activeModal)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    } else if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && document.activeElement.getAttribute('role') !== 'combobox') {
      const input = document.querySelector('input[type="search"]');
      if (input) { event.preventDefault(); input.focus(); }
    }
  }, { signal: pagina.signal });
});
