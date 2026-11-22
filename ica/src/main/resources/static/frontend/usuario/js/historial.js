import { alMontarPagina } from '../../compartido/js/pagina.js';
import { claseEstado, mostrarPagoYape } from '../../compartido/js/estados-venta.js';
import { sesion } from '../../compartido/js/comun.js';
import { solicitar, fechaCompra } from '../../compartido/js/api.js';
import { animarEntrada, escapar, moneda } from '../../compartido/js/interfaz.js';

alMontarPagina('#history-list', vista => {
  if (!sesion.id) { location.replace('/frontend/auth/login.html'); return; }
  let compras = [], pagina = 0, peticion = 0;
  const lista = document.getElementById('history-list'), refresh = document.getElementById('history-refresh');
  const feedback = document.getElementById('history-feedback');
  const detalles = new Map();
  function render() {
    const buscar = document.getElementById('history-search').value.trim().toLowerCase();
    const estado = document.getElementById('history-state').value;
    const filtradas = compras.filter(c => (!estado || c.estado === estado) && `V-${String(c.idVenta).padStart(4, '0')}`.toLowerCase().includes(buscar.replace('#', '')));
    pagina = Math.max(0, Math.min(pagina, Math.ceil(filtradas.length / 8) - 1));
    lista.replaceChildren();
    if (!filtradas.length) lista.innerHTML = `<div class="empty-state-card"><strong>${compras.length ? 'No hay compras con esos filtros.' : 'Tu primera historia está por llegar.'}</strong><p>${compras.length ? 'Prueba con otro código o estado.' : 'Cuando completes una compra, podrás consultar aquí sus libros y cantidades.'}</p>${compras.length ? '' : '<a class="btn-secondary" href="/frontend/usuario/productos.html">Explorar el catálogo</a>'}</div>`;
    filtradas.slice(pagina * 8, (pagina + 1) * 8).forEach(compra => {
      const id = compra.idVenta, card = document.createElement('article'); card.className = 'history-order';
      card.innerHTML = `<div class="history-order-head"><div class="history-order-title"><h3>Compra #V-${String(id).padStart(4, '0')}</h3><p>${escapar(fechaCompra(compra.fecha))} · ${escapar(compra.metodoPago)} · ${escapar(compra.tipoComprobante)}</p></div><div class="history-order-actions"><span class="status-tag ${claseEstado(compra.estado)}">${escapar(compra.estado)}</span><strong>${escapar(moneda(compra.total))}</strong><button type="button" class="btn-action-edit" aria-expanded="false" aria-controls="purchase-${id}">Ver libros</button></div></div><div id="purchase-${id}" class="history-detail" hidden></div>`;
      const button = card.querySelector('button'), detail = card.querySelector('.history-detail');
      let solicitudDetalle = 0;
      button.addEventListener('click', async () => {
        const abrir = detail.hidden; detail.hidden = !abrir; button.setAttribute('aria-expanded', String(abrir)); button.textContent = abrir ? 'Ocultar libros' : 'Ver libros';
        if (!abrir) return;
        const request = ++solicitudDetalle;
        detail.innerHTML = '<p class="requirements-feedback">Cargando libros…</p>';
        try {
          const items = detalles.get(id) || await solicitar(`mis-compras/${id}/detalle`, {}, vista.fetch);
          if (vista.signal.aborted || request !== solicitudDetalle || !detail.isConnected) return;
          detalles.set(id, items);
          detail.innerHTML = items.map(it => `<div class="cart-row"><div><h4 class="cart-item-title">${escapar(it.tituloLibro || 'Libro')}</h4><p>ISBN ${escapar(it.isbn)} · ${escapar(moneda(it.precioUnitario))} por unidad</p></div><div>${Number(it.cantidad)} ${Number(it.cantidad) === 1 ? 'ejemplar' : 'ejemplares'} · <strong>${escapar(moneda(it.subtotal))}</strong></div></div>`).join('') || '<p class="requirements-feedback">No hay detalle disponible.</p>';
          animarEntrada(detail.children);
        } catch (error) { if (!vista.signal.aborted) detail.innerHTML = `<p class="requirements-feedback" role="alert">${escapar(error.message)} Cierra y vuelve a abrir el detalle para reintentar.</p>`; }
      });
      if (compra.estado === 'Pendiente' && compra.metodoPago === 'Yape' && compra.vencePago) {
        const qr = document.createElement('button');
        qr.type = 'button';
        qr.className = 'btn-action-edit';
        qr.textContent = 'Ver QR';
        qr.addEventListener('click', () => {
          if (new Date(`${compra.vencePago}-05:00`) <= new Date()) cargar();
          else mostrarPagoYape(compra);
        });
        card.querySelector('.history-order-actions').insertBefore(qr, button);
      }
      lista.appendChild(card);
    });
    document.getElementById('history-page').textContent = filtradas.length ? `${pagina * 8 + 1}–${Math.min((pagina + 1) * 8, filtradas.length)} de ${filtradas.length} ${filtradas.length === 1 ? 'compra' : 'compras'}` : 'Sin compras para mostrar';
    document.getElementById('history-prev').disabled = pagina === 0;
    document.getElementById('history-next').disabled = (pagina + 1) * 8 >= filtradas.length;
    animarEntrada(lista.children);
  }
  async function cargar() {
    const request = ++peticion; refresh.disabled = true; lista.setAttribute('aria-busy', 'true'); feedback.hidden = true;
    try {
      const datos = await solicitar('mis-compras', {}, vista.fetch);
      if (vista.signal.aborted || request !== peticion) return;
      compras = datos; detalles.clear();
      document.getElementById('history-count').textContent = compras.length;
      document.getElementById('history-total').textContent = moneda(compras.filter(c => ['Completada', 'Confirmada'].includes(c.estado)).reduce((total, c) => total + Number(c.total), 0));
      document.getElementById('history-latest').textContent = compras.length ? new Date(compras[0].fecha).toLocaleDateString('es-PE') : 'Aún no hay compras';
      render();
    } catch (error) {
      if (vista.signal.aborted) return;
      feedback.hidden = false; feedback.textContent = error.message;
      lista.innerHTML = '<div class="empty-state-card">No pudimos cargar tus compras. Usa Actualizar para reintentar.</div>';
      ['history-count', 'history-total', 'history-latest'].forEach(id => { document.getElementById(id).textContent = 'No disponible'; });
      ['history-prev', 'history-next'].forEach(id => { document.getElementById(id).disabled = true; });
    } finally { if (!vista.signal.aborted) { refresh.disabled = false; lista.setAttribute('aria-busy', 'false'); } }
  }
  document.getElementById('history-search').addEventListener('input', () => { pagina = 0; render(); });
  document.getElementById('history-state').addEventListener('change', () => { pagina = 0; render(); });
  document.getElementById('history-prev').addEventListener('click', () => { --pagina; render(); });
  document.getElementById('history-next').addEventListener('click', () => { ++pagina; render(); });
  refresh.addEventListener('click', cargar);
  return cargar();
});
