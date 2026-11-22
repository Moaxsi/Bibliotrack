import { alMontarPagina } from './pagina.js';

const controles = new WeakMap();
let secuencia = 0;

export function actualizarSelectores(root) {
  root.querySelectorAll('select').forEach(select => controles.get(select)?.());
}

alMontarPagina('body', vista => {
  let abierto;
  const raiz = document.body;

  function aplicar(select) {
    if (controles.has(select) || select.multiple || select.size > 1) return;
    const id = `biblio-selector-${++secuencia}`;
    const trigger = document.createElement('button');
    const label = document.createElement('span');
    const list = document.createElement('div');
    const wrapper = document.createElement('div');
    trigger.type = 'button';
    trigger.className = 'biblio-select-trigger';
    trigger.id = id;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}-list`);
    trigger.append(label);
    label.id = `${id}-value`;
    wrapper.className = 'biblio-select';
    list.className = 'biblio-select-options';
    list.id = `${id}-list`;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    const topLayer = typeof list.showPopover === 'function';
    if (topLayer) list.setAttribute('popover', 'manual');

    const labels = [...select.labels];
    const name = select.getAttribute('aria-label') || labels.map(el => [...el.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim()).filter(Boolean).join(' ')).filter(Boolean).join(' ') || 'Seleccionar opción';
    trigger.setAttribute('aria-label', name);
    list.setAttribute('aria-label', name);
    const focusLabel = event => {
      if (labels.includes(event.target)) {
        event.preventDefault();
        trigger.focus();
      }
    };
    labels.forEach(el => el.addEventListener('click', focusLabel, { signal: vista.signal }));
    select.after(wrapper);
    wrapper.append(select, trigger, list);
    select.classList.add('biblio-select-original');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    let indice = -1;
    let texto = '';
    let ultimo = 0;
    const disponibles = () => [...select.options].map((option, i) => ({ option, i }))
      .filter(({ option }) => !option.hidden && !option.disabled && !option.closest('optgroup')?.disabled);
    const actualizar = () => {
      label.textContent = select.selectedOptions[0]?.label || 'Selecciona una opción';
      trigger.disabled = select.disabled;
      trigger.setAttribute('aria-required', String(select.required));
      if (trigger.disabled && abierto?.trigger === trigger) cerrar();
    };

    function cerrar() {
      if (abierto?.trigger !== trigger) return;
      abierto = undefined;
      if (topLayer && list.matches(':popover-open')) list.hidePopover();
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
    }

    function posicionar() {
      const rect = trigger.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) { cerrar(); return; }
      const debajo = innerHeight - rect.bottom - 12;
      const encima = rect.top - 12;
      const arriba = debajo < 180 && encima > debajo;
      list.style.width = `${rect.width}px`;
      list.style.left = `${rect.left}px`;
      list.style.maxHeight = `${Math.min(260, Math.max(60, arriba ? encima : debajo))}px`;
      list.style.top = arriba ? 'auto' : `${rect.bottom + 5}px`;
      list.style.bottom = arriba ? `${innerHeight - rect.top + 5}px` : 'auto';
    }

    function marcar(i) {
      indice = i;
      list.querySelectorAll('[data-index]').forEach(el => el.classList.toggle('is-current', Number(el.dataset.index) === i));
      const activo = list.querySelector(`[data-index="${i}"]`);
      if (activo) {
        trigger.setAttribute('aria-activedescendant', activo.id);
        activo.scrollIntoView({ block: 'nearest' });
      } else trigger.removeAttribute('aria-activedescendant');
    }

    function abrir(primero = false) {
      actualizar();
      if (trigger.disabled) return;
      abierto?.cerrar();
      list.replaceChildren();
      const opciones = disponibles();
      if (!opciones.length) return;
      for (const { option, i } of opciones) {
        const item = document.createElement('div');
        item.id = `${id}-option-${i}`;
        item.dataset.index = i;
        item.textContent = option.label;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected));
        list.append(item);
      }
      abierto = { trigger, list, cerrar, posicionar };
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (topLayer) list.showPopover();
      posicionar();
      marcar(primero ? opciones[0].i : (opciones.find(({ option }) => option.selected) || opciones[0]).i);
    }

    function seleccionar(i) {
      if (!disponibles().some(el => el.i === i)) return;
      const cambia = select.selectedIndex !== i;
      select.selectedIndex = i;
      trigger.removeAttribute('aria-invalid');
      actualizar();
      cerrar();
      if (cambia) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    trigger.addEventListener('click', () => abierto?.trigger === trigger ? cerrar() : abrir());
    trigger.addEventListener('keydown', event => {
      const activo = abierto?.trigger === trigger;
      if (event.key === 'Escape' && activo) {
        event.preventDefault();
        event.stopPropagation();
        cerrar();
      } else if (event.key === 'Tab') cerrar();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!activo) abrir();
        if (!activo && event.key === 'ArrowDown') return;
        const indices = disponibles().map(el => el.i);
        if (!indices.length) return;
        const actual = indices.indexOf(indice);
        const siguiente = { Home: 0, End: indices.length - 1, ArrowUp: actual - 1, ArrowDown: actual + 1 }[event.key];
        marcar(indices[Math.max(0, Math.min(siguiente, indices.length - 1))]);
      } else if (['Enter', ' '].includes(event.key) && activo) {
        event.preventDefault();
        seleccionar(indice);
      } else if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (!activo) abrir();
        const ahora = performance.now();
        texto = (ahora - ultimo > 600 ? '' : texto) + event.key.toLocaleLowerCase('es');
        ultimo = ahora;
        const encontrado = disponibles().find(({ option }) => option.label.toLocaleLowerCase('es').startsWith(texto));
        if (encontrado) marcar(encontrado.i);
      }
    });
    list.addEventListener('pointerdown', event => event.preventDefault());
    list.addEventListener('click', event => {
      const item = event.target.closest('[data-index]');
      if (item) seleccionar(Number(item.dataset.index));
    });
    select.addEventListener('invalid', event => {
      event.preventDefault();
      trigger.setAttribute('aria-invalid', 'true');
      trigger.focus();
      abrir(true);
    });
    select.addEventListener('change', actualizar);
    controles.set(select, actualizar);
    actualizar();
  }

  raiz.querySelectorAll('select').forEach(aplicar);
  const cambios = new MutationObserver(registros => {
    for (const registro of registros) {
      const select = registro.target.nodeType === Node.ELEMENT_NODE
        ? registro.target.closest('select') : registro.target.parentElement?.closest('select');
      if (select) controles.get(select)?.();
      for (const nodo of registro.addedNodes) {
        if (nodo.nodeType !== Node.ELEMENT_NODE) continue;
        if (nodo.matches('select')) aplicar(nodo);
        nodo.querySelectorAll('select').forEach(aplicar);
      }
    }
    if (abierto && !abierto.trigger.isConnected) abierto.cerrar();
  });
  cambios.observe(raiz, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['disabled', 'required', 'selected', 'label'] });
  raiz.addEventListener('reset', event => queueMicrotask(() => actualizarSelectores(event.target)), { signal: vista.signal });
  document.addEventListener('pointerdown', event => {
    if (abierto && !abierto.trigger.contains(event.target) && !abierto.list.contains(event.target)) abierto.cerrar();
  }, { signal: vista.signal });
  window.addEventListener('resize', () => abierto?.posicionar(), { signal: vista.signal });
  document.addEventListener('scroll', event => {
    if (abierto && event.target !== abierto.list) abierto.posicionar();
  }, { capture: true, signal: vista.signal });
  vista.alSalir(() => { abierto?.cerrar(); cambios.disconnect(); });
});
