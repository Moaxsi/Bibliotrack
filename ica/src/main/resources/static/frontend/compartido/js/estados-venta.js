import { fechaCompra } from './api.js';
import { moneda } from './interfaz.js';

export function claseEstado(estado) {
  if (estado === 'Confirmada') return 'confirmada';
  if (estado === 'Completada') return 'activo';
  if (estado === 'Pendiente') return 'pendiente';
  return 'inactivo';
}

export function mostrarPagoYape(venta) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'checkout-yape-dialog';
  dialogo.setAttribute('aria-labelledby', 'yape-dialog-title');
  dialogo.innerHTML = `
    <div class="checkout-yape-head">
      <div><span class="status-tag pendiente">Pendiente de confirmación</span><h2 id="yape-dialog-title">Paga tu pedido con Yape</h2></div>
      <button type="button" class="btn-close-modal" aria-label="Cerrar instrucciones de Yape" autofocus>×</button>
    </div>
    <p class="checkout-hint">Escanea el QR y paga el importe indicado. Tienes 24 horas desde el registro. Verás la confirmación en tu historial cuando el administrador revise el pago.</p>
    <img src="/frontend/compartido/imagenes/yape-qr.png" width="445" height="424" alt="Código QR para pagar con Yape">
    <div class="summary-line"><span id="yape-order"></span><strong id="yape-total"></strong></div>
    <div class="summary-line"><span>Plazo de pago</span><strong id="yape-deadline"></strong></div>
    <a class="btn-primary-action" href="/frontend/usuario/historial.html">Ir a mi historial</a>`;
  dialogo.querySelector('#yape-order').textContent = `Compra V-${String(venta.idVenta).padStart(4, '0')}`;
  dialogo.querySelector('#yape-total').textContent = moneda(venta.total);
  dialogo.querySelector('#yape-deadline').textContent = `${fechaCompra(venta.vencePago)} (Lima)`;
  const enfocar = document.activeElement;
  dialogo.querySelector('button').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('close', () => {
    dialogo.remove();
    if (enfocar?.isConnected) enfocar.focus();
  }, { once: true });
  if (location.pathname.endsWith('/historial.html')) dialogo.querySelector('a').hidden = true;
  document.body.append(dialogo);
  dialogo.showModal();
}
