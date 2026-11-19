import { alMontarPagina } from '../../compartido/js/pagina.js';
import { API_URL, notificar } from '../../compartido/js/comun.js';
import { obtenerCategorias } from '../../compartido/js/categorias.js';
import { agregarAlCarrito } from './carrito.js';
import { animarEntrada, escapar, portadaSegura, moneda } from '../../compartido/js/interfaz.js';

alMontarPagina('#books-grid-container', (pagina) => {
  let libros = [], categoriaActiva = 0;
  const grid = document.getElementById('books-grid-container');
  const resultado = document.getElementById('catalog-result-count');
  async function cargarCategorias() {
    try {
      const categorias = await obtenerCategorias();
      if (pagina.signal.aborted) return;
      const container = document.getElementById('category-pills-container');
      container.replaceChildren();
      [{ idCategoria: 0, nombre: 'Todos' }, ...categorias].forEach(cat => {
        const button = document.createElement('button');
        button.dataset.category = String(cat.idCategoria);
        button.type = 'button'; button.className = `pill-btn${cat.idCategoria === categoriaActiva ? ' active' : ''}`;
        button.setAttribute('aria-pressed', String(cat.idCategoria === categoriaActiva)); button.textContent = cat.nombre;
        button.addEventListener('click', () => window.filtrarPorCategoria(cat.idCategoria, button)); container.appendChild(button);
      });
    } catch (error) { if (!pagina.signal.aborted) notificar(error.message); }
  }
  window.filtrarPorCategoria = (id, element) => {
    categoriaActiva = id;
    document.querySelectorAll('#category-pills-container .pill-btn').forEach(b => { b.classList.toggle('active', b === element); b.setAttribute('aria-pressed', String(b === element)); });
    window.filtrarPorTexto();
  };
  window.filtrarPorTexto = () => {
    const query = document.getElementById('input-buscar-libro').value.toLocaleLowerCase('es').trim();
    const filtered = libros.filter(l => (!categoriaActiva || l.categoria?.idCategoria === categoriaActiva) && (`${l.titulo} ${l.autor} ${l.isbn}`.toLocaleLowerCase('es').includes(query) || (query && l.isbn.replace(/[-\s]/g, '').toLowerCase().includes(query.replace(/[-\s]/g, '')))));
    resultado.textContent = `${filtered.length} ${filtered.length === 1 ? 'libro disponible' : 'libros disponibles'}`;
    grid.replaceChildren();
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state-card"><strong>No encontramos esa historia.</strong><p>Prueba con otro título, autor o categoría.</p><button type="button" class="btn-secondary">Ver todos los libros</button></div>';
      grid.querySelector('button').onclick = () => { document.getElementById('input-buscar-libro').value = ''; window.filtrarPorCategoria(0, document.querySelector('#category-pills-container .pill-btn')); };
      return;
    }
    filtered.forEach(libro => {
      const agotado = libro.stock <= 0;
      const card = document.createElement('article'); card.className = 'book-card';
      card.innerHTML = `<div class="book-cover-wrap"><img src="${portadaSegura(libro.urlPortada)}" alt="Portada de ${escapar(libro.titulo)}" class="book-cover-img" loading="lazy" decoding="async"><span class="badge-stock ${agotado ? 'agotado' : ''}">${agotado ? 'Agotado' : 'Disponible'}</span></div><div class="book-info-body"><span class="book-category-tag">${escapar(libro.categoria?.nombre || 'General')}</span><h3 class="book-title">${escapar(libro.titulo)}</h3><p class="book-author">${escapar(libro.autor)}</p><p class="book-isbn">ISBN ${escapar(libro.isbn)}</p><p class="book-desc">${escapar(libro.descripcion || 'Una nueva historia por descubrir.')}</p><div class="book-meta-footer"><div class="price-box"><span class="price-val">${escapar(moneda(libro.precioVenta))}</span><span class="stock-val">${Number(libro.stock) || 0} en stock</span></div><button type="button" class="btn-add-cart" ${agotado ? 'disabled' : ''} aria-label="Agregar ${escapar(libro.titulo)} al carrito">${agotado ? 'Sin stock' : '+ Agregar'}</button></div></div>`;
      card.querySelector('img').addEventListener('error', event => { event.target.src = '/frontend/compartido/imagenes/portada.png'; }, { once: true });
      card.querySelector('button').addEventListener('click', event => {
        const added = agregarAlCarrito(libro);
        if (added) { const btn = event.currentTarget; btn.textContent = 'Agregado'; setTimeout(() => { if (btn.isConnected) btn.textContent = '+ Agregar'; }, 1200); }
      });
      grid.appendChild(card);
    });
    animarEntrada(grid.children);
  };
  async function cargar() {
    grid.setAttribute('aria-busy', 'true');
    try {
      const response = await pagina.fetch(`${API_URL}/libros`);
      if (!response.ok) throw new Error('No pudimos cargar el catálogo.');
      const data = await response.json();
      if (pagina.signal.aborted) return;
      if (!Array.isArray(data)) throw new Error('El catálogo no está disponible.');
      libros = data.filter(l => String(l.estado || 'Activo').toLowerCase() === 'activo');
      document.getElementById('catalog-total').textContent = `${libros.length} títulos por descubrir`;
      window.filtrarPorTexto();
    } catch {
      if (pagina.signal.aborted) return;
      resultado.textContent = 'Catálogo no disponible';
      grid.innerHTML = '<div class="empty-state-card"><strong>No pudimos cargar los libros.</strong><p>Comprueba tu conexión e inténtalo de nuevo.</p><button type="button" class="btn-secondary">Reintentar</button></div>';
      grid.querySelector('button').onclick = cargar;
    } finally { grid.setAttribute('aria-busy', 'false'); }
  }
  return Promise.all([cargarCategorias(), cargar()]);
});
