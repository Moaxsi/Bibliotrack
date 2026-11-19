import { alMontarPagina } from '../../compartido/js/pagina.js';
import { animarEntrada, animarNumero, abrirModal, cerrarModal, escapar, portadaSegura } from '../../compartido/js/interfaz.js';
import { API_URL, rutas, sesion, notificar } from '../../compartido/js/comun.js';
import { requiereAdmin } from '../../compartido/js/comun.js';
import { obtenerCategorias, poblarCategorias } from '../../compartido/js/categorias.js';
import { fetchConToken } from '../../compartido/js/comun.js';

alMontarPagina('#admin-books-table-body', (pagina) => {
  if (!requiereAdmin()) return;
  let catalogoLibros = [];
  const tablaAdminBody = document.getElementById('admin-books-table-body');
  let idLibroAEliminar = null;

  async function cargarCategoriasAdmin() {
    const filtro = document.getElementById('admin-filter-category');
    const formulario = document.getElementById('form-categoria');
    try {
      const categorias = await obtenerCategorias();
      if (pagina.signal.aborted) return false;
      poblarCategorias(filtro, categorias, 'Todas las categorías', '0');
      poblarCategorias(formulario, categorias, 'Selecciona categoría', '');
      return true;
    } catch (err) {
      if (pagina.signal.aborted) return;
      notificar(err.message);
      return false;
    }
  }

  async function cargarLibrosAdmin() {
    try {
      const res = await pagina.fetch(`${API_URL}/libros`);
      if (!res.ok) throw new Error('Inventario no disponible');
      catalogoLibros = await res.json();
      if (pagina.signal.aborted) return;
      if (!Array.isArray(catalogoLibros)) throw new Error('Inventario no válido');
      const metrics = { 'inventory-total': catalogoLibros.length, 'inventory-stock': catalogoLibros.reduce((n, l) => n + Number(l.stock || 0), 0), 'inventory-active': catalogoLibros.filter(l => String(l.estado).toLowerCase() === 'activo').length, 'inventory-low': catalogoLibros.filter(l => Number(l.stock) <= 5).length };
      Object.entries(metrics).forEach(([id, value]) => animarNumero(document.getElementById(id), value, n => Math.round(n).toLocaleString('es-PE')));
      window.filtrarTablaAdmin();
    } catch (err) {
      if (pagina.signal.aborted) return;
      if (tablaAdminBody) {
        tablaAdminBody.innerHTML = '<tr><td colspan="9" class="empty-table-cell">No pudimos cargar el inventario. Recarga la página para reintentar.</td></tr>';
      }
    }
  }

  function renderizarTablaAdmin(lista) {
    if (!tablaAdminBody) return;
    document.getElementById('inventory-result-count').textContent = `${lista.length} títulos en esta vista`;

    if (lista.length === 0) {
      tablaAdminBody.innerHTML = '<tr><td colspan="9" class="empty-table-cell">No hay libros registrados.</td></tr>';
      return;
    }

    tablaAdminBody.innerHTML = '';
    lista.forEach(libro => {
      const portada = libro.urlPortada && libro.urlPortada.trim() !== ''
        ? libro.urlPortada
        : '/frontend/compartido/imagenes/portada.png';

      const catNombre = libro.categoria ? libro.categoria.nombre : 'Sin categoría';
      const esActivo = (libro.estado || 'Activo').toLowerCase() === 'activo';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <img src="${portadaSegura(portada)}" alt="${escapar(libro.titulo)}" class="table-cover-thumb" onerror="this.onerror=null;this.src='/frontend/compartido/imagenes/portada.png'">
        </td>
        <td><strong>${escapar(libro.isbn)}</strong></td>
        <td>${escapar(libro.titulo)}</td>
        <td>${escapar(libro.autor)}</td>
        <td>${escapar(catNombre)}</td>
        <td>S/ ${parseFloat(libro.precioVenta).toFixed(2)}</td>
        <td><strong>${libro.stock}</strong></td>
        <td>
          <button type="button" class="status-pill-toggle ${esActivo ? 'activo' : 'inactivo'}"
                  onclick="alternarEstadoLibro(${libro.idLibro}, '${esActivo ? 'Activo' : 'Inactivo'}')"
                  title="Clic para cambiar estado">
            ${esActivo ? 'Activo' : 'Inactivo'}
          </button>
        </td>
        <td>
          <div class="action-buttons-wrap">
            <button type="button" class="btn-action-edit" onclick="abrirModalEditarLibro(${libro.idLibro})">Editar</button>
            <button type="button" class="btn-action-delete" data-delete="true">Eliminar</button>
          </div>
        </td>
      `;
      tr.querySelector('[data-delete]').addEventListener('click', () => window.abrirModalEliminar(libro.idLibro, libro.titulo));
      tablaAdminBody.appendChild(tr);
    });
    animarEntrada(tablaAdminBody.children);
  }

  window.alternarEstadoLibro = async function(id, estadoActual) {
    const nuevoEstado = (estadoActual || 'Activo').toLowerCase() === 'activo' ? 'Inactivo' : 'Activo';
    try {
      const res = await fetchConToken(`${API_URL}/libros/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (pagina.signal.aborted) return;
      if (!res.ok) { notificar('No se pudo cambiar el estado. Comprueba tu sesión.'); return; }
      if (res.ok) {
        notificar(`Estado cambiado a ${nuevoEstado}.`);
        cargarLibrosAdmin();
      }
    } catch (err) {
      if (pagina.signal.aborted) return;
      notificar('Error al cambiar el estado.');
    }
  };

  window.filtrarTablaAdmin = function() {
    const texto = (document.getElementById('admin-search-input')?.value || '').toLowerCase();
    const idCat = parseInt(document.getElementById('admin-filter-category')?.value || '0');

    const filtrados = catalogoLibros.filter(l => {
      const t = (l.titulo || '').toLowerCase();
      const a = (l.autor || '').toLowerCase();
      const i = (l.isbn || '').toLowerCase();
      const coincideTexto = t.includes(texto) || a.includes(texto) || i.includes(texto);
      const coincideCat = (idCat === 0) || (l.categoria && l.categoria.idCategoria === idCat);
      return coincideTexto && coincideCat;
    });

    renderizarTablaAdmin(filtrados);
  };

  window.abrirModalCrearLibro = async function() {
    if (!await cargarCategoriasAdmin()) return;
    document.getElementById('modal-libro-titulo').textContent = 'Registrar Libro';
    document.getElementById('form-libro').reset();
    document.getElementById('form-libro-id').value = '';
    document.getElementById('form-portada').dataset.currentUrl = '';
    document.getElementById('form-portada-preview').hidden = true;
    document.getElementById('form-isbn').disabled = false;
    document.getElementById('form-estado').value = 'Activo';
    abrirModal('modal-libro-form');
  };

  window.abrirModalEditarLibro = async function(id) {
    if (!await cargarCategoriasAdmin()) return;
    const libro = catalogoLibros.find(l => l.idLibro === id);
    if (!libro) return;

    document.getElementById('modal-libro-titulo').textContent = 'Editar Libro';
    document.getElementById('form-libro-id').value = libro.idLibro;
    document.getElementById('form-isbn').value = libro.isbn;
    document.getElementById('form-isbn').disabled = true;
    document.getElementById('form-titulo').value = libro.titulo;
    document.getElementById('form-autor').value = libro.autor;
    document.getElementById('form-categoria').value = libro.categoria ? libro.categoria.idCategoria : '';
    document.getElementById('form-precio').value = libro.precioVenta;
    document.getElementById('form-stock').value = libro.stock;
    document.getElementById('form-estado').value = libro.estado || 'Activo';
    document.getElementById('form-portada').value = '';
    document.getElementById('form-portada').dataset.currentUrl = libro.urlPortada || '';
    const portadaPreview = document.getElementById('form-portada-preview');
    portadaPreview.src = libro.urlPortada || '';
    portadaPreview.hidden = !libro.urlPortada;
    document.getElementById('form-descripcion').value = libro.descripcion || '';

    abrirModal('modal-libro-form');
  };

  window.cerrarModalLibro = function() {
    cerrarModal('modal-libro-form');
  };

  window.guardarLibro = async function(e) {
    e.preventDefault();
    const saveButton = e.submitter || document.querySelector('#form-libro button[type=submit]');
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Guardando…';
    const id = document.getElementById('form-libro-id').value;
    const isbn = document.getElementById('form-isbn').value.trim();
    const titulo = document.getElementById('form-titulo').value.trim();
    const autor = document.getElementById('form-autor').value.trim();
    const idCat = document.getElementById('form-categoria').value;
    const precio = document.getElementById('form-precio').value;
    const stock = document.getElementById('form-stock').value;
    const estado = document.getElementById('form-estado').value;
    const inputPortada = document.getElementById('form-portada');
    let url = inputPortada.dataset.currentUrl || '';
    const desc = document.getElementById('form-descripcion').value.trim();

    const payload = {
      isbn: isbn,
      titulo: titulo,
      autor: autor,
      idCategoria: parseInt(idCat),
      precioVenta: parseFloat(precio),
      stock: parseInt(stock),
      estado: estado,
      urlPortada: url,
      descripcion: desc
    };

    try {
      if (inputPortada.files.length > 0) {
        const imageForm = new FormData();
        imageForm.append('file', inputPortada.files[0]);
        const imageResponse = await fetchConToken(`${API_URL}/libros/imagen`, {
          method: 'POST',
          body: imageForm
        });
        const imageData = await imageResponse.json();
        if (pagina.signal.aborted) return;
        if (!imageResponse.ok) {
          notificar(imageData.error || 'No se pudo subir la imagen.');
          return;
        }
        url = imageData.urlPortada;
      }
      payload.urlPortada = url;

      let res;
      if (id) {
        res = await fetchConToken(`${API_URL}/libros/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetchConToken(`${API_URL}/libros`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (pagina.signal.aborted) return;
      if (res.ok) {
        notificar(id ? 'Libro actualizado con éxito.' : 'Libro creado con éxito.');
        window.cerrarModalLibro();
        cargarLibrosAdmin();
      } else {
        notificar(data.error || 'Error al guardar libro.');
      }
    } catch (err) {
      if (pagina.signal.aborted) return;
      notificar('Error de conexión con el servidor.');
    } finally { saveButton.disabled = false; saveButton.textContent = 'Guardar libro'; }
  };

  document.getElementById('form-portada').addEventListener('change', event => {
    const file = event.target.files[0];
    const preview = document.getElementById('form-portada-preview');
    if (!file) {
      preview.hidden = !event.target.dataset.currentUrl;
      preview.src = event.target.dataset.currentUrl || '';
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  window.abrirModalEliminar = function(id, titulo) {
    idLibroAEliminar = id;
    document.getElementById('delete-prompt-text').textContent = `¿Seguro que deseas eliminar "${titulo}"?`;
    abrirModal('modal-eliminar-libro');
  };

  window.cerrarModalEliminar = function() {
    idLibroAEliminar = null;
    cerrarModal('modal-eliminar-libro');
  };

  const btnConfirmDel = document.getElementById('btn-confirm-delete');
  if (btnConfirmDel) {
    btnConfirmDel.onclick = async () => {
      if (!idLibroAEliminar) return;
      try {
        const res = await fetchConToken(`${API_URL}/libros/${idLibroAEliminar}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (pagina.signal.aborted) return;
        if (res.ok) {
          notificar('Libro eliminado correctamente.');
          window.cerrarModalEliminar();
          cargarLibrosAdmin();
        } else {
          notificar(data.error || 'No se pudo eliminar el libro.');
        }
      } catch (err) {
        if (pagina.signal.aborted) return;
        notificar('Error de conexión al eliminar.');
      }
    };
  }


  return Promise.all([cargarCategoriasAdmin(), cargarLibrosAdmin()]);
});
