import { alMontarPagina } from '../../compartido/js/pagina.js';
import { requiereAdmin, notificar } from '../../compartido/js/comun.js';
import { solicitar } from '../../compartido/js/api.js';
import { abrirModal, cerrarModal, escapar, moneda } from '../../compartido/js/interfaz.js';

alMontarPagina('#new-sale', vista => {
  if (!requiereAdmin()) return;
  let libros = [];
  const form = document.getElementById('sale-form'), lineas = document.getElementById('sale-lines');
  const error = document.getElementById('sale-errors'), trigger = document.getElementById('new-sale');
  function total() {
    let importe = 0;
    lineas.querySelectorAll('.sale-line').forEach(row => { const libro = libros.find(l => l.idLibro === Number(row.querySelector('select').value)); importe += Number(libro?.precioVenta || 0) * Number(row.querySelector('input').value || 0); });
    document.getElementById('sale-total').textContent = moneda(importe);
  }
  function agregar() {
    const row = document.createElement('div'); row.className = 'sale-line';
    row.innerHTML = `<label>Libro<select required aria-label="Libro de la venta"><option value="">Selecciona un libro</option>${libros.map(l => `<option value="${l.idLibro}">${escapar(l.titulo)} · ${escapar(moneda(l.precioVenta))} · ${l.stock} disponibles</option>`).join('')}</select></label><label>Cantidad<input type="number" min="1" step="1" value="1" required aria-label="Cantidad del libro"></label><button type="button" class="btn-secondary" aria-label="Quitar libro">×</button>`;
    row.querySelector('button').onclick = () => { row.remove(); total(); };
    row.querySelector('select').onchange = () => { const libro = libros.find(l => l.idLibro === Number(row.querySelector('select').value)); row.querySelector('input').max = libro?.stock || 1; total(); };
    row.querySelector('input').oninput = total; lineas.appendChild(row);
  }
  trigger.addEventListener('click', async () => {
    trigger.disabled = true; error.hidden = true; form.reset(); lineas.replaceChildren();
    try {
      const [cuentas, catalogo] = await Promise.all([solicitar('usuarios', {}, vista.fetch), solicitar('libros', {}, vista.fetch)]);
      if (vista.signal.aborted) return;
      libros = catalogo.filter(l => l.estado === 'Activo' && l.stock > 0);
      const clientes = cuentas.filter(u => u.rol === 'CLIENTE' && u.estado === 'Activo');
      document.getElementById('sale-client').innerHTML = '<option value="">Selecciona al cliente</option>' + clientes.map(u => `<option value="${u.idUsuario}">${escapar(u.nombre)} · ${escapar(u.email)}</option>`).join('');
      agregar(); total(); abrirModal('modal-nueva-venta');
      if (!clientes.length || !libros.length) { error.hidden = false; error.textContent = 'Necesitas al menos un cliente activo y un libro disponible para registrar una venta.'; }
    } catch (exception) { if (!vista.signal.aborted) notificar(exception.message); }
    finally { trigger.disabled = false; }
  });
  document.getElementById('sale-add').addEventListener('click', agregar);
  ['sale-cancel', 'sale-close'].forEach(id => document.getElementById(id).addEventListener('click', () => cerrarModal('modal-nueva-venta')));
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = document.getElementById('sale-save'); if (button.disabled) return;
    error.hidden = true;
    const items = [...lineas.querySelectorAll('.sale-line')].map(row => ({ idLibro: Number(row.querySelector('select').value), cantidad: Number(row.querySelector('input').value) }));
    if (!items.length) { error.hidden = false; error.textContent = 'Añade al menos un libro.'; error.focus(); return; }
    button.disabled = true; button.textContent = 'Registrando…';
    try {
      await solicitar('ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idCliente: Number(document.getElementById('sale-client').value), metodoPago: document.getElementById('sale-payment').value, tipoComprobante: document.getElementById('sale-receipt').value, items }) });
      if (vista.signal.aborted) return;
      cerrarModal('modal-nueva-venta'); notificar('Venta registrada. El inventario y el historial del cliente se actualizaron.');
      document.getElementById('report-refresh').click();
    } catch (exception) { if (!vista.signal.aborted) { error.hidden = false; error.textContent = exception.message; error.focus(); } }
    finally { button.disabled = false; button.textContent = 'Registrar venta'; }
  });
});
