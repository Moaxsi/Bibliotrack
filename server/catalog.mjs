import { cents, choice, fail, integer, optional, text } from './rules.mjs';
import { transaction } from './db.mjs';

export const bookSelect = `SELECT l.*, c.nombre AS categoria_nombre, c.descripcion AS categoria_descripcion FROM libros l JOIN categorias c USING (id_categoria)`;
export function book(row) {
  return { idLibro: row.id_libro, categoria: { idCategoria: row.id_categoria, nombre: row.categoria_nombre, descripcion: row.categoria_descripcion }, isbn: row.isbn, titulo: row.titulo, autor: row.autor, descripcion: row.descripcion, precioVenta: Number(row.precio_venta), stock: row.stock, urlPortada: row.url_portada, estado: row.estado, fechaCreacion: row.fecha_creacion };
}
export async function catalog(db, params) {
  const search = (params.get('buscar') || '').trim().toLowerCase();
  if (search.length > 200) fail('buscar: usa hasta 200 caracteres');
  const rawCategory = params.get('categoria');
  const category = rawCategory && Number(rawCategory) > 0 ? integer(rawCategory, 'categoria') : null;
  const { rows } = await db.query(`${bookSelect} WHERE ($1::integer IS NULL OR l.id_categoria=$1) AND ($2='' OR lower(l.titulo) LIKE '%'||$2||'%' OR lower(l.autor) LIKE '%'||$2||'%' OR lower(replace(replace(l.isbn,'-',''),' ','')) LIKE '%'||$3||'%') ORDER BY l.id_libro DESC`, [category, search, search.replace(/[- ]/g, '')]);
  return rows.map(book);
}
export async function getBook(db, id) {
  const { rows: [row] } = await db.query(`${bookSelect} WHERE l.id_libro=$1`, [id]);
  if (!row) fail('Libro no encontrado', 404);
  return book(row);
}
export async function saveBook(db, id, data) {
  return transaction(db, async client => {
    let current = {};
    if (id) {
      const { rows } = await client.query('SELECT * FROM libros WHERE id_libro=$1 FOR UPDATE', [id]);
      if (!rows[0]) fail('Libro no encontrado', 404);
      current = rows[0];
    }
    const values = { ...current };
    if (!id || 'isbn' in data) {
      values.isbn = text(data, 'isbn', 20).replace(/[- ]/g, '').toUpperCase();
      if (!/^(?:\d{9}[\dX]|\d{13})$/.test(values.isbn)) fail('isbn: ingresa un ISBN de 10 o 13 caracteres');
      const duplicate = await client.query("SELECT 1 FROM libros WHERE upper(replace(replace(isbn,'-',''),' ',''))=$1 AND ($2::integer IS NULL OR id_libro<>$2)", [values.isbn, id]);
      if (duplicate.rowCount) fail('isbn: el código ISBN ya existe en el catálogo');
    }
    for (const [key, max] of [['titulo', 200], ['autor', 150]]) if (!id || key in data) values[key] = text(data, key, max);
    if (!id || 'precioVenta' in data) values.precio_venta = (cents(data.precioVenta) / 100).toFixed(2);
    if (!id || 'stock' in data) values.stock = integer(data.stock, 'stock', 0);
    if (!id || 'idCategoria' in data) {
      values.id_categoria = integer(data.idCategoria, 'idCategoria');
      if (!(await client.query('SELECT 1 FROM categorias WHERE id_categoria=$1', [values.id_categoria])).rowCount) fail('idCategoria: selecciona una categoría válida');
    }
    if ('descripcion' in data) values.descripcion = optional(data, 'descripcion', 10000);
    if ('urlPortada' in data) {
      values.url_portada = optional(data, 'urlPortada', 500);
      if (values.url_portada && !/^(?:https:\/\/|\/(?!\/))/.test(values.url_portada)) fail('urlPortada: usa una imagen HTTPS o una ruta local');
    }
    if (!id || 'estado' in data) values.estado = choice(data.estado ?? 'Activo', ['Activo', 'Inactivo'], 'estado');
    const keys = ['id_categoria', 'isbn', 'titulo', 'autor', 'descripcion', 'precio_venta', 'stock', 'url_portada', 'estado'];
    const args = keys.map(key => values[key] ?? null);
    let result;
    if (id) result = await client.query(`UPDATE libros SET ${keys.map((key, index) => `${key}=$${index + 1}`).join(',')} WHERE id_libro=$10 RETURNING id_libro`, [...args, id]);
    else result = await client.query(`INSERT INTO libros (${keys.join(',')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(',')}) RETURNING id_libro`, args);
    return getBook(client, result.rows[0].id_libro);
  });
}
export async function deleteBook(db, id) {
  return transaction(db, async client => {
    if (!(await client.query('SELECT 1 FROM libros WHERE id_libro=$1 FOR UPDATE', [id])).rowCount) fail('Libro no encontrado', 404);
    if ((await client.query('SELECT 1 FROM detalle_ventas WHERE id_libro=$1 LIMIT 1', [id])).rowCount) fail('El libro tiene ventas registradas. Desactívalo para conservar el historial de compras.', 409);
    await client.query('DELETE FROM libros WHERE id_libro=$1', [id]);
    return { mensaje: 'Libro eliminado correctamente' };
  });
}
