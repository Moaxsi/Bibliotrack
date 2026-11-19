import { API_URL, fetchConToken, limpiarSesion } from './comun.js';

export async function solicitar(ruta, opciones = {}, lector = fetch) {
  const response = await fetchConToken(`${API_URL}/${ruta}`, opciones, lector);
  if (response.status === 401) {
    limpiarSesion();
    location.replace('/frontend/auth/login.html');
    throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
  }
  const datos = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(datos.error || (response.status === 403 ? 'No tienes permiso para esta operación.' : 'No se pudo completar la operación. Vuelve a intentarlo.'));
  return datos;
}

export const fechaCompra = valor => {
  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
