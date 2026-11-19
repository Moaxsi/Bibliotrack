import { API_URL } from './comun.js';

let cargaPendiente;
export function obtenerCategorias() {
  if (!cargaPendiente) {
    cargaPendiente = fetch(`${API_URL}/categorias`, { signal: AbortSignal.timeout(8000) }).then(async respuesta => {
      if (!respuesta.ok) throw new Error('No se pudieron cargar las categorías.');
      const categorias = await respuesta.json();
      if (!Array.isArray(categorias)) throw new Error('Respuesta de categorías no válida.');
      return categorias;
    }).catch(error => {
      cargaPendiente = null;
      throw error;
    });
  }
  return cargaPendiente;
}

export function poblarCategorias(select, categorias, etiqueta, valorInicial) {
  if (!select) return;
  const seleccionado = select.value;
  select.replaceChildren(new Option(etiqueta, valorInicial));
  categorias.forEach(categoria => {
    select.add(new Option(categoria.nombre, String(categoria.idCategoria)));
  });
  select.value = Array.from(select.options).some(opcion => opcion.value === seleccionado)
    ? seleccionado : valorInicial;
}
