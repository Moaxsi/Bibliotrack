import { alMontarPagina } from '../../compartido/js/pagina.js';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set();
const ease = [.22, 1, .36, 1];
function animate(target, values, options = {}) {
  if (reduced.matches || !window.Motion) return null;
  const animation = window.Motion.animate(target, values, options);
  running.add(animation);
  animation.then(() => running.delete(animation));
  return animation;
}
function finalState() {
  running.forEach(animation => animation.complete());
  running.clear();
}
reduced.addEventListener('change', event => { if (event.matches) finalState(); });
window.addEventListener('pageshow', event => {
  if (!event.persisted || !document.querySelector('.access-page')) return;
  finalState();
  const layer = document.querySelector('.access-success');
  if (layer) layer.hidden = true;
  const button = document.querySelector('button[type="submit"]');
  if (button) estadoBoton(button, button.id === 'btn-login' ? 'Iniciar sesión' : 'Crear mi cuenta');
});

export function estadoBoton(button, text, busy = false) {
  const label = button.querySelector('[data-button-label]');
  if (label) label.textContent = text; else button.textContent = text;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}
export function errorAcceso(message) {
  const feedback = document.getElementById('auth-feedback');
  if (feedback) { feedback.textContent = message; feedback.hidden = false; }
  animate('.access-content .form-box', { transform: ['translateX(0px)', 'translateX(-5px)', 'translateX(5px)', 'translateX(0px)'] }, { duration: .24 });
}
export function limpiarErrorAcceso() {
  const feedback = document.getElementById('auth-feedback');
  if (feedback) { feedback.hidden = true; feedback.textContent = ''; }
}
export async function celebrarAcceso(nombre, registro = false) {
  const layer = document.querySelector('.access-success');
  if (!layer) return;
  document.getElementById('success-title').textContent = registro ? 'Tu primer capítulo está listo.' : `Bienvenido${nombre ? `, ${nombre.split(' ')[0]}` : ''}.`;
  document.getElementById('success-description').textContent = registro ? 'Tu cuenta está creada. Vamos a iniciar sesión.' : 'Entrando a tu biblioteca…';
  layer.hidden = false;
  const controls = animate(layer, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: .32, ease });
  animate('.success-check path', { pathLength: [0, 1] }, { duration: .4, delay: .12, ease: 'easeOut' });
  animate('.success-content', { opacity: [0, 1], transform: ['translateY(18px) scale(.97)', 'translateY(0px) scale(1)'] }, { duration: .45, ease });
  if (controls) await Promise.race([new Promise(resolve => setTimeout(resolve, 650)), controls.then(() => new Promise(resolve => setTimeout(resolve, 260)))]);
}

alMontarPagina('.access-page', (pagina) => {
  if (!document.querySelector('.access-page')) return;
  if (!document.documentElement.dataset.routeTransition && window.Motion && !reduced.matches) {
    animate('[data-title-line]', { transform: ['translateY(105%) rotate(2deg)', 'translateY(0%) rotate(0deg)'], opacity: [.3, 1] }, { duration: .68, delay: window.Motion.stagger(.065, { startDelay: .06 }), ease });
    animate('[data-auth-reveal]', { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0px)'] }, { duration: .45, delay: window.Motion.stagger(.045, { startDelay: .2 }), ease });
    animate('.visual-curtain', { transform: ['scaleX(1)', 'scaleX(0)'] }, { duration: .8, ease });
    animate('[data-visual-line]', { transform: ['translateY(105%)', 'translateY(0%)'] }, { duration: .65, delay: window.Motion.stagger(.07, { startDelay: .28 }), ease });
    animate('[data-visual-reveal], .visual-bookmark', { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, { duration: .45, delay: window.Motion.stagger(.045, { startDelay: .4 }), ease });
  }
  const visual = document.querySelector('.access-visual');
  const photo = visual?.querySelector('img');
  let bounds = null, photoMotion = null;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const movePhoto = (x, y) => {
    photoMotion?.stop();
    running.delete(photoMotion);
    photoMotion = animate(photo, { transform: `translate(${x}px,${y}px) scale(1.06)` }, { type: 'spring', stiffness: 90, damping: 24 });
  };
  visual?.addEventListener('pointerenter', () => { bounds = visual.getBoundingClientRect(); });
  visual?.addEventListener('pointermove', event => {
    if (!bounds || !fine.matches || reduced.matches || !photo) return;
    movePhoto((event.clientX - bounds.left - bounds.width / 2) / bounds.width * 14, (event.clientY - bounds.top - bounds.height / 2) / bounds.height * 10);
  });
  visual?.addEventListener('pointerleave', () => { if (photo && !reduced.matches) movePhoto(0, 0); });
  pagina.alSalir(finalState);
});
