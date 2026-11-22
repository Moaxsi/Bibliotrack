import { transaction } from './db.mjs';
import { userSelect } from './auth.mjs';
import { cents, choice, fail, integer, text } from './rules.mjs';

const limaNow = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')";
const yapeDeadline = "fecha + INTERVAL '24 hours'";
export const saleDates = `${yapeDeadline} AS vence_yape, ${limaNow} >= ${yapeDeadline} AS yape_vencida`;

export const saleView = row => ({
  idVenta: row.id_venta, idUsuario: row.id_usuario, fecha: row.fecha, total: Number(row.total),
  metodoPago: row.metodo_pago, tipoComprobante: row.tipo_comprobante,
  estado: row.estado === 'Pendiente' && row.yape_vencida ? 'Vencida' : row.estado,
  ...(row.metodo_pago === 'Yape' && row.estado === 'Pendiente' ? { vencePago: row.vence_yape } : {}),
  ...(row.cliente_nombre ? {
    clienteNombre: row.cliente_nombre, clienteEmail: row.cliente_email,
    documentoComprobante: row.documento_comprobante, nombreComprobante: row.nombre_comprobante,
    nombrePagadorYape: row.nombre_pagador_yape
  } : {})
});
export async function saleDetail(db, id) {
  const { rows } = await db.query(`SELECT d.*,l.titulo,l.isbn,l.autor,l.url_portada FROM detalle_ventas d JOIN libros l USING (id_libro) WHERE d.id_venta=$1 ORDER BY d.id_detalle_venta`, [id]);
  return rows.map(row => ({ idDetalleVenta: row.id_detalle_venta, cantidad: row.cantidad, precioUnitario: Number(row.precio_unitario), subtotal: Number(row.subtotal), tituloLibro: row.titulo, isbn: row.isbn, autor: row.autor, urlPortada: row.url_portada }));
}
export async function reservedCopies(db, ids) {
  const { rows } = await db.query(
    `SELECT d.id_libro, SUM(d.cantidad)::int AS cantidad FROM detalle_ventas d
     JOIN ventas v USING (id_venta)
     WHERE d.id_libro=ANY($1::integer[]) AND v.metodo_pago='Yape' AND v.estado='Pendiente'
       AND ${yapeDeadline} > (statement_timestamp() AT TIME ZONE 'America/Lima')
     GROUP BY d.id_libro`, [ids]
  );
  return new Map(rows.map(row => [row.id_libro, row.cantidad]));
}
export async function registerSale(db, data, user) {
  const admin = user.rol.toUpperCase() === 'ADMIN';
  if ('idCliente' in data && !admin) fail('Solo un administrador puede registrar ventas para otro cliente', 403);
  const clientId = 'idCliente' in data ? integer(data.idCliente, 'idCliente') : user.id_usuario;
  const payment = choice(data.metodoPago ?? 'Efectivo', ['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia'], 'metodoPago');
  const payerName = payment === 'Yape' && !admin ? text(data, 'nombrePagadorYape', 120) : null;
  const receipt = choice(data.tipoComprobante ?? 'Boleta', ['Boleta', 'Boleta de venta', 'Factura'], 'tipoComprobante');
  let document = null;
  let receiptName = null;
  if (receipt === 'Boleta de venta' || receipt === 'Factura' && (!admin || 'documentoComprobante' in data)) {
    document = text(data, 'documentoComprobante', 11);
    const digits = receipt === 'Factura' ? 11 : 8;
    if (!new RegExp(`^[0-9]{${digits}}$`).test(document)) fail(`El comprobante requiere un documento de ${digits} dígitos.`);
    receiptName = text(data, 'nombreComprobante', 200);
  }
  const pending = payment === 'Yape' && !('idCliente' in data);
  const estado = pending ? 'Pendiente' : 'Completada';
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
    const reserved = await reservedCopies(client, ids);
    let total = 0;
    for (const book of books) {
      if (book.estado !== 'Activo') fail(`El libro '${book.titulo}' ya no está disponible`);
      const available = Math.max(0, book.stock - (reserved.get(book.id_libro) || 0));
      if (available < amounts.get(book.id_libro)) fail(`Stock insuficiente para '${book.titulo}'. Disponible: ${available}`);
      total += cents(book.precio_venta) * amounts.get(book.id_libro);
    }
    if (!Number.isSafeInteger(total) || total <= 0 || total > 9999999999) fail('total: el importe es demasiado grande');
    const values = [clientId, (total / 100).toFixed(2), payment, receipt, estado, document, receiptName];
    const yapeColumn = payerName === null ? '' : ',nombre_pagador_yape';
    const yapeValue = payerName === null ? '' : ',$8';
    if (payerName !== null) values.push(payerName);
    const { rows: [sale] } = await client.query(
      `INSERT INTO ventas (id_usuario,fecha,total,metodo_pago,tipo_comprobante,estado,documento_comprobante,nombre_comprobante${yapeColumn})
       VALUES ($1,statement_timestamp() AT TIME ZONE 'America/Lima',$2,$3,$4,$5,$6,$7${yapeValue}) RETURNING id_venta, ${saleDates}`,
      values
    );
    for (const book of books) {
      const quantity = amounts.get(book.id_libro);
      await client.query('INSERT INTO detalle_ventas (id_venta,id_libro,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)', [sale.id_venta, book.id_libro, quantity, book.precio_venta, (cents(book.precio_venta) * quantity / 100).toFixed(2)]);
      if (!pending) await client.query('UPDATE libros SET stock=stock-$1 WHERE id_libro=$2', [quantity, book.id_libro]);
    }
    return {
      success: true, mensaje: pending ? 'Compra pendiente de confirmación' : 'Compra registrada con éxito',
      idVenta: sale.id_venta, total: total / 100, estado,
      ...(pending ? { vencePago: sale.vence_yape } : {})
    };
  });
}

export async function decideYapeSale(db, id, decision) {
  const estado = choice(decision, ['Confirmada', 'Rechazada'], 'estado');
  return transaction(db, async client => {
    const { rows: [sale] } = await client.query(
      `SELECT estado, metodo_pago FROM ventas WHERE id_venta=$1 FOR UPDATE`, [id]
    );
    if (!sale) fail('Compra no encontrada', 404);
    if (sale.metodo_pago !== 'Yape') fail('Solo se pueden revisar compras por Yape.', 409);
    if (sale.estado === estado) return { idVenta: id, estado };
    if (sale.estado !== 'Pendiente') fail('Esta compra ya fue revisada.', 409);

    if (estado === 'Confirmada') {
      const { rows: books } = await client.query(
        `SELECT l.id_libro,l.titulo,l.stock,l.estado,d.cantidad FROM detalle_ventas d
         JOIN libros l USING (id_libro) WHERE d.id_venta=$1 ORDER BY l.id_libro FOR UPDATE OF l`, [id]
      );
      if (!books.length) fail('La compra no tiene libros registrados.', 409);
      for (const book of books) {
        if (book.estado !== 'Activo' || book.stock < book.cantidad) {
          fail(`«${book.titulo}» ya no tiene disponibilidad suficiente. Revisa el inventario o rechaza la compra.`, 409);
        }
        await client.query('UPDATE libros SET stock=stock-$1 WHERE id_libro=$2', [book.cantidad, book.id_libro]);
      }
    }

    // clock_timestamp reflects time spent waiting for locks, unlike CURRENT_TIMESTAMP.
    const result = await client.query(
      `UPDATE ventas SET estado=$2 WHERE id_venta=$1 AND
       (clock_timestamp() AT TIME ZONE 'America/Lima') < ${yapeDeadline}`, [id, estado]
    );
    if (!result.rowCount) fail('El plazo de 24 horas de esta compra venció.', 409);
    return { idVenta: id, estado };
  });
}
