import { transaction } from './db.mjs';
import { userSelect } from './auth.mjs';
import { cents, choice, fail, integer } from './rules.mjs';

export const saleView = row => ({ idVenta: row.id_venta, idUsuario: row.id_usuario, fecha: row.fecha, total: Number(row.total), metodoPago: row.metodo_pago, tipoComprobante: row.tipo_comprobante, estado: row.estado, ...(row.cliente_nombre ? { clienteNombre: row.cliente_nombre, clienteEmail: row.cliente_email } : {}) });
export async function saleDetail(db, id) {
  const { rows } = await db.query(`SELECT d.*,l.titulo,l.isbn,l.autor,l.url_portada FROM detalle_ventas d JOIN libros l USING (id_libro) WHERE d.id_venta=$1 ORDER BY d.id_detalle_venta`, [id]);
  return rows.map(row => ({ idDetalleVenta: row.id_detalle_venta, cantidad: row.cantidad, precioUnitario: Number(row.precio_unitario), subtotal: Number(row.subtotal), tituloLibro: row.titulo, isbn: row.isbn, autor: row.autor, urlPortada: row.url_portada }));
}
export async function registerSale(db, data, user) {
  const admin = user.rol.toUpperCase() === 'ADMIN';
  if ('idCliente' in data && !admin) fail('Solo un administrador puede registrar ventas para otro cliente', 403);
  const clientId = 'idCliente' in data ? integer(data.idCliente, 'idCliente') : user.id_usuario;
  const payment = choice(data.metodoPago ?? 'Efectivo', ['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia'], 'metodoPago');
  const receipt = choice(data.tipoComprobante ?? 'Boleta', ['Boleta', 'Factura'], 'tipoComprobante');
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 200) fail('Selecciona entre 1 y 200 libros para la compra');
  const amounts = new Map();
  for (const item of data.items) {
    if (!item || typeof item !== 'object') fail('El detalle de compra no es válido');
    const id = integer(item.idLibro, 'idLibro');
    amounts.set(id, integer((amounts.get(id) || 0) + integer(item.cantidad, 'cantidad'), 'cantidad'));
  }
  return transaction(db, async client => {
    const { rows: [buyer] } = await client.query(`${userSelect} WHERE u.id_usuario=$1 FOR SHARE OF u`, [clientId]);
    if (!buyer || buyer.estado !== 'Activo') fail('idCliente: la cuenta no está activa');
    if ('idCliente' in data && buyer.rol.toUpperCase() !== 'CLIENTE') fail('idCliente: selecciona una cuenta de cliente');
    const ids = [...amounts.keys()].sort((a, b) => a - b);
    const { rows: books } = await client.query('SELECT * FROM libros WHERE id_libro=ANY($1::integer[]) ORDER BY id_libro FOR UPDATE', [ids]);
    if (books.length !== ids.length) fail('Uno de los libros ya no existe');
    let total = 0;
    for (const book of books) {
      if (book.estado !== 'Activo') fail(`El libro '${book.titulo}' ya no está disponible`);
      if (book.stock < amounts.get(book.id_libro)) fail(`Stock insuficiente para '${book.titulo}'. Disponible: ${book.stock}`);
      total += cents(book.precio_venta) * amounts.get(book.id_libro);
    }
    if (!Number.isSafeInteger(total) || total <= 0 || total > 9999999999) fail('total: el importe es demasiado grande');
    const { rows: [sale] } = await client.query("INSERT INTO ventas (id_usuario,total,metodo_pago,tipo_comprobante,estado) VALUES ($1,$2,$3,$4,'Completada') RETURNING id_venta", [clientId, (total / 100).toFixed(2), payment, receipt]);
    for (const book of books) {
      const quantity = amounts.get(book.id_libro);
      await client.query('INSERT INTO detalle_ventas (id_venta,id_libro,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)', [sale.id_venta, book.id_libro, quantity, book.precio_venta, (cents(book.precio_venta) * quantity / 100).toFixed(2)]);
      await client.query('UPDATE libros SET stock=stock-$1 WHERE id_libro=$2', [quantity, book.id_libro]);
    }
    return { success: true, mensaje: 'Compra registrada con éxito', idVenta: sale.id_venta, total: total / 100 };
  });
}
