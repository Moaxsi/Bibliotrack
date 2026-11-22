import { alMontarPagina } from '../../compartido/js/pagina.js';
import { escapar, portadaSegura, movimientoReducido } from '../../compartido/js/interfaz.js';
import { sesion, notificar } from '../../compartido/js/comun.js';
import { solicitar } from '../../compartido/js/api.js';
import { mostrarPagoYape } from '../../compartido/js/estados-venta.js';
import { configurarPago } from './pago.js';
let carrito;
try { carrito = JSON.parse(localStorage.getItem('bibliotrack_cart')) || []; }
catch { carrito = []; }

alMontarPagina('body', (pagina) => {
  try { carrito = JSON.parse(localStorage.getItem('bibliotrack_cart')) || []; } catch { carrito = []; }

  function guardarCarrito() {
    localStorage.setItem('bibliotrack_cart', JSON.stringify(carrito));
    actualizarContadorCarrito();
  }

  function actualizarContadorCarrito() {
    const counter = document.getElementById('cart-counter');
    if (!counter) return;
    const totalItems = carrito.reduce((acc, it) => acc + it.cantidad, 0);
    counter.textContent = totalItems;
  }
  actualizarContadorCarrito();

  const tablaCarritoBody = document.getElementById('cart-table-body');
  if (!tablaCarritoBody) return;
  const form = document.getElementById('checkout-form');
  const boton = document.getElementById('btn-procesar-compra');
  const error = document.getElementById('checkout-error');
  const pago = configurarPago(pagina.fetch);
  let procesando = false;
  pagina.alSalir(pago.salir);
  renderizarPaginaCarrito();

  function renderizarPaginaCarrito() {
    const subtotalEl = document.getElementById('cart-subtotal-val');
    const totalEl = document.getElementById('cart-total-val');
    boton.disabled = procesando || carrito.length === 0;

    if (carrito.length === 0) {
      tablaCarritoBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-table-cell">
            Tu carrito está vacío. <br><br>
            <a href="/frontend/usuario/productos.html" class="btn-secondary-link">&larr; Ver libros disponibles</a>
          </td>
        </tr>
      `;
      if (subtotalEl) subtotalEl.textContent = 'S/ 0.00';
      if (totalEl) totalEl.textContent = 'S/ 0.00';
      return;
    }

    tablaCarritoBody.innerHTML = '';
    let totalGeneral = 0;

    carrito.forEach((item, index) => {
      const subtotalItem = item.precio * item.cantidad;
      totalGeneral += subtotalItem;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="cart-book-item">
            <img src="${portadaSegura(item.urlPortada)}" alt="${escapar(item.titulo)}" class="cart-book-thumb" onerror="this.onerror=null;this.src='/frontend/compartido/imagenes/portada.png'">
            <div class="cart-book-info">
              <h4>${escapar(item.titulo)}</h4>
              <span>${escapar(item.autor)} (ISBN: ${escapar(item.isbn)})</span>
            </div>
          </div>
        </td>
        <td>S/ ${item.precio.toFixed(2)}</td>
        <td>
          <div class="qty-control-box">
            <button type="button" class="btn-qty-sm" aria-label="Reducir cantidad" onclick="cambiarCantidad(${index}, -1)">-</button>
            <strong>${item.cantidad}</strong>
            <button type="button" class="btn-qty-sm" aria-label="Aumentar cantidad" onclick="cambiarCantidad(${index}, 1)">+</button>
          </div>
        </td>
        <td><strong>S/ ${subtotalItem.toFixed(2)}</strong></td>
        <td>
          <button type="button" class="btn-remove-item" onclick="eliminarDelCarrito(${index})" title="Eliminar" aria-label="Eliminar libro del carrito">&times;</button>
        </td>
      `;
      tablaCarritoBody.appendChild(tr);
    });

    if (subtotalEl) subtotalEl.textContent = `S/ ${totalGeneral.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `S/ ${totalGeneral.toFixed(2)}`;
  }

  window.cambiarCantidad = function(idx, delta) {
    if (procesando || !carrito[idx]) return;
    const nueva = carrito[idx].cantidad + delta;
    if (nueva <= 0) {
      carrito.splice(idx, 1);
    } else {
      if (Number.isFinite(carrito[idx].stockMax) && nueva > carrito[idx].stockMax) {
        notificar(`Stock límite: solo quedan ${carrito[idx].stockMax} unidades.`);
        return;
      }
      carrito[idx].cantidad = nueva;
    }
    guardarCarrito();
    renderizarPaginaCarrito();
  };

  window.eliminarDelCarrito = function(idx) {
    if (procesando) return;
    carrito.splice(idx, 1);
    guardarCarrito();
    renderizarPaginaCarrito();
  };

  window.vaciarCarritoCompleto = function() {
    if (procesando || carrito.length === 0) return;
    carrito = [];
    guardarCarrito();
    renderizarPaginaCarrito();
    notificar('Se vació el carrito.');
  };

  form.noValidate = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (procesando || !carrito.length) return;
    error.hidden = true;
    if (!sesion.id) {
      notificar('Inicia sesión para completar tu compra.');
      window.biblioNavigate('/frontend/auth/login.html');
      return;
    }

    pago.validar();
    if (!form.reportValidity()) return;
    const datos = pago.datos();
    const items = carrito.map(({ idLibro, cantidad }) => ({ idLibro, cantidad }));
    procesando = true;
    boton.disabled = true;
    boton.textContent = 'Registrando pedido…';
    const controles = form.querySelectorAll('input, select');
    controles.forEach(el => { el.disabled = true; });
    try {
      const venta = await solicitar('ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, items })
      }, pagina.fetch);
      const cantidades = new Map(items.map(({ idLibro, cantidad }) => [idLibro, cantidad]));
      try {
        carrito = JSON.parse(localStorage.getItem('bibliotrack_cart')) || [];
      } catch {
        carrito = [];
      }
      carrito = carrito.map(it => ({ ...it, cantidad: it.cantidad - (cantidades.get(it.idLibro) || 0) }))
        .filter(it => it.cantidad > 0);
      guardarCarrito();
      if (pagina.signal.aborted) return;
      pago.finalizar();
      if (venta.estado === 'Pendiente') mostrarPagoYape(venta);
      else if (datos.metodoPago === 'Tarjeta') notificar('Pedido registrado sin cargo. Puedes verlo en Historial.');
      else notificar('Compra confirmada. Puedes ver sus libros en Historial.');
    } catch (exception) {
      if (pagina.signal.aborted) return;
      error.hidden = false;
      error.textContent = exception.message;
      error.focus();
    } finally {
      if (!pagina.signal.aborted) {
        procesando = false;
        controles.forEach(el => { el.disabled = false; });
        boton.textContent = 'Procesar compra';
        renderizarPaginaCarrito();
      }
    }
  });
});

export function agregarAlCarrito(libro) {
    if (!libro) return;
    if (libro.stock <= 0) {
      notificar('Este ejemplar está agotado.');
      return;
    }

    const itemExistente = carrito.find(it => it.idLibro === libro.idLibro);
    if (itemExistente) {
      if (itemExistente.cantidad + 1 > libro.stock) {
        notificar('Alcanzaste el límite de stock de este libro.');
        return;
      }
      itemExistente.cantidad++;
    } else {
      carrito.push({
        idLibro: libro.idLibro,
        titulo: libro.titulo,
        autor: libro.autor,
        isbn: libro.isbn,
        urlPortada: libro.urlPortada || '/frontend/compartido/imagenes/portada.png',
        precio: parseFloat(libro.precioVenta),
        stockMax: libro.stock,
        cantidad: 1
      });
    }

    localStorage.setItem('bibliotrack_cart', JSON.stringify(carrito));
    const counter = document.getElementById('cart-counter');
    if (counter) counter.textContent = carrito.reduce((total, item) => total + item.cantidad, 0);
    notificar(`«${libro.titulo}» agregado al carrito.`);
    if (counter && !movimientoReducido() && window.Motion) window.Motion.animate(counter, { scale: [1, 1.3, 1] }, { duration: .3 });
    return true;
  };
