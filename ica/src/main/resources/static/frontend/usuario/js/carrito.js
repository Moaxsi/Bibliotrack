import { alMontarPagina } from '../../compartido/js/pagina.js';
import { animarEntrada, escapar, portadaSegura, movimientoReducido } from '../../compartido/js/interfaz.js';
import { API_URL, rutas, sesion, notificar } from '../../compartido/js/comun.js';
import { fetchConToken } from '../../compartido/js/comun.js';
const idUsuarioActual = sesion.id;
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
  if (tablaCarritoBody) {
    renderizarPaginaCarrito();
  }

  function renderizarPaginaCarrito() {
    const subtotalEl = document.getElementById('cart-subtotal-val');
    const totalEl = document.getElementById('cart-total-val');
    if (!tablaCarritoBody) return;

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
    if (!carrito[idx]) return;
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
    carrito.splice(idx, 1);
    guardarCarrito();
    renderizarPaginaCarrito();
  };

  window.vaciarCarritoCompleto = function() {
    if (carrito.length === 0) return;
    carrito = [];
    guardarCarrito();
    renderizarPaginaCarrito();
    notificar('Se vació el carrito.');
  };

  window.ejecutarCompraFinal = async function() {
    if (carrito.length === 0) {
      notificar('El carrito está vacío.');
      return;
    }

    if (!idUsuarioActual) {
      notificar('Debes iniciar sesión para confirmar tu compra.');
      setTimeout(() => {
        if (!pagina.signal.aborted) window.biblioNavigate('/frontend/auth/login.html');
      }, 1200);
      return;
    }

    const metodo = document.getElementById('order-metodo-pago').value;
    const comprobante = document.getElementById('order-tipo-comprobante').value;
    const btn = document.getElementById('btn-procesar-compra');
    if (btn.disabled) return;

    btn.disabled = true;
    btn.textContent = 'Confirmando tu compra…';

    const payload = {
      metodoPago: metodo,
      tipoComprobante: comprobante,
      items: carrito.map(it => ({
        idLibro: it.idLibro,
        cantidad: it.cantidad
      }))
    };

    try {
      const res = await fetchConToken(`${API_URL}/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 401) {
        notificar('Tu sesión terminó. Inicia sesión para continuar.');
        window.location.href = '/frontend/auth/login.html';
        return;
      }

      if (res.ok) {
        notificar('¡Compra registrada con éxito!');
        carrito = [];
        guardarCarrito();
        renderizarPaginaCarrito();
        notificar('Puedes consultar esta compra en Historial.');
      } else {
        notificar(data.error || 'No se pudo procesar la venta.');
      }
    } catch (err) {
      notificar('Error de conexión con el servidor.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Procesar Compra';
    }
  };
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
