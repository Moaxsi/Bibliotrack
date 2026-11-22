import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../../server/app.mjs';
import sharp from 'sharp';

// A newly created LOCAL database is used for all writes. Never use cloud credentials here.
const name = `bibliotrack_cloud_test_${process.pid}_${Date.now()}`;
const config = { host: 'localhost', user: 'postgres', database: 'postgres' };
const admin = new pg.Client(config);
let db, handle, adminToken, clientToken;
async function call(route, { method = 'GET', body, token, form } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  const response = await handle(new Request(`https://test.invalid/api/${route}`, { method, headers, body: form || (body && JSON.stringify(body)) }));
  return { status: response.status, data: await response.json() };
}
before(async () => {
  process.env.BIBLIOTRACK_JWT_SECRET = 'isolated-test-secret-that-is-never-used-in-production';
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  db = new pg.Pool({ ...config, database: name, options: '-c timezone=UTC' });
  await db.query(await readFile(new URL('../../ica/sql/migracion_01_implementacionBD.sql', import.meta.url), 'utf8'));
  await db.query(await readFile(new URL('../../sql/cloud-checkout.sql', import.meta.url), 'utf8'));
  // Roles anon/authenticated are Supabase-specific, so use only the table definition locally.
  const images = await readFile(new URL('../../sql/cloud-portadas.sql', import.meta.url), 'utf8');
  await db.query(images.slice(0, images.indexOf('REVOKE')));
  handle = createApp(() => db);
  const a = await call('login', { method: 'POST', body: { email: 'admin@bibliotrack.com', password: 'admin123' } });
  const c = await call('login', { method: 'POST', body: { email: 'carlos@gmail.com', password: 'cliente123' } });
  assert.equal(a.status, 200); assert.equal(c.status, 200);
  adminToken = a.data.token; clientToken = c.data.token;
});
after(async () => {
  await db?.end();
  if (name.startsWith('bibliotrack_cloud_test_')) await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.end();
});

test('catalog and category JSON match the existing frontend', async () => {
  const books = await call('libros');
  assert.equal(books.status, 200); assert.equal(books.data.length, 34);
  assert.equal(typeof books.data[0].precioVenta, 'number');
  assert.ok(books.data[0].categoria.idCategoria);
  assert.equal((await call('categorias')).data.length, 4);
  const filtered = await call('libros?buscar=clean');
  assert.ok(filtered.data.some(book => book.titulo === 'Clean Code'));
  assert.deepEqual((await call("libros?buscar=';DROP%20TABLE%20libros;--")).data, []);
  assert.equal((await call('libros/999999')).status, 404);
});
test('authentication rejects guests, forged tokens and customer admin access', async () => {
  assert.equal((await call('usuarios')).status, 401);
  assert.equal((await call('usuarios', { token: 'forged' })).status, 401);
  assert.equal((await call('usuarios', { token: clientToken })).status, 403);
  assert.equal((await call('login', { method: 'POST', body: { email: 'admin@bibliotrack.com', password: 'wrong' } })).status, 401);
  const users = await call('usuarios', { token: adminToken });
  assert.equal(users.status, 200); assert.ok(users.data.every(user => !('password' in user)));
});
test('public registration ignores requested admin privileges', async () => {
  const registration = await call('register', { method: 'POST', body: { nombre: 'Prueba aislada', email: 'new@example.test', password: 'test12345', idRol: 1, estado: 'Activo' } });
  assert.equal(registration.status, 200);
  const login = await call('login', { method: 'POST', body: { email: 'new@example.test', password: 'test12345' } });
  assert.equal(login.data.rol, 'CLIENTE');
  assert.equal((await call('register', { method: 'POST', body: { nombre: 'Otra', email: 'new@example.test', password: 'test12345' } })).status, 400);
});
test('book CRUD validates prices and retains sale history', async () => {
  const data = { isbn: '9789999999991', titulo: 'Libro de prueba aislada', autor: 'Pruebas', idCategoria: 1, precioVenta: '12.34', stock: 3, estado: 'Activo' };
  assert.equal((await call('libros', { method: 'POST', body: { ...data, precioVenta: '1.001' }, token: adminToken })).status, 400);
  const created = await call('libros', { method: 'POST', body: data, token: adminToken });
  assert.equal(created.status, 200);
  const id = created.data.idLibro;
  const updated = await call(`libros/${id}`, { method: 'PUT', body: { stock: 4 }, token: adminToken });
  assert.equal(updated.data.stock, 4);
  assert.equal((await call(`libros/${id}`, { method: 'DELETE', token: adminToken })).status, 200);
  const sold = (await db.query('SELECT id_libro FROM detalle_ventas LIMIT 1')).rows[0].id_libro;
  assert.equal((await call(`libros/${sold}`, { method: 'DELETE', token: adminToken })).status, 409);
});
test('checkout merges duplicate lines, ignores client prices and protects private history', async () => {
  const { rows: [book] } = await db.query('SELECT * FROM libros WHERE stock>5 LIMIT 1');
  const sale = await call('ventas', { method: 'POST', token: clientToken, body: { total: 0.01, items: [{ idLibro: book.id_libro, cantidad: 1, precioVenta: 0.01 }, { idLibro: book.id_libro, cantidad: 1 }] } });
  assert.equal(sale.status, 200); assert.equal(sale.data.total, Number(book.precio_venta) * 2);
  const { rows: [saved] } = await db.query("SELECT fecha, CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' AS hora_lima, current_setting('TimeZone') AS zona FROM ventas WHERE id_venta=$1", [sale.data.idVenta]);
  assert.equal(saved.zona, 'UTC');
  assert.ok(Math.abs(new Date(saved.fecha) - new Date(saved.hora_lima)) < 30000, 'La venta debe guardar la hora de Lima aunque la conexión use UTC');
  assert.equal((await db.query('SELECT stock FROM libros WHERE id_libro=$1', [book.id_libro])).rows[0].stock, book.stock - 2);
  assert.equal((await call(`mis-compras/${sale.data.idVenta}/detalle`, { token: clientToken })).data[0].cantidad, 2);
  assert.equal((await call(`mis-compras/${sale.data.idVenta}/detalle`, { token: adminToken })).status, 404);
  assert.equal((await call('ventas', { method: 'POST', token: clientToken, body: { idCliente: 1, items: [{ idLibro: book.id_libro, cantidad: 1 }] } })).status, 403);
});
test('failed checkout rolls back and concurrent checkouts cannot oversell', async () => {
  const { rows: [book] } = await db.query("INSERT INTO libros (id_categoria,isbn,titulo,autor,precio_venta,stock,estado) VALUES (1,'9789999999992','Concurrencia','Pruebas',10.10,1,'Activo') RETURNING *");
  const count = Number((await db.query('SELECT count(*) FROM ventas')).rows[0].count);
  const invalid = await call('ventas', { method: 'POST', token: clientToken, body: { items: [{ idLibro: book.id_libro, cantidad: 2 }] } });
  assert.equal(invalid.status, 400);
  assert.equal(Number((await db.query('SELECT count(*) FROM ventas')).rows[0].count), count);
  const results = await Promise.all([1, 2].map(() => call('ventas', { method: 'POST', token: clientToken, body: { items: [{ idLibro: book.id_libro, cantidad: 1 }] } })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  assert.equal((await db.query('SELECT stock FROM libros WHERE id_libro=$1', [book.id_libro])).rows[0].stock, 0);
});
test('Yape reserves the book until an administrator confirms, rejects or the deadline expires', async () => {
  const { rows: [book] } = await db.query(
    "INSERT INTO libros (id_categoria,isbn,titulo,autor,precio_venta,stock,estado) VALUES (1,'9789999999993','Yape de prueba','Pruebas',12.50,2,'Activo') RETURNING id_libro"
  );
  const items = [{ idLibro: book.id_libro, cantidad: 1 }];
  const order = (metodoPago = 'Yape') => call('ventas', { method: 'POST', token: clientToken, body: { metodoPago, items } });
  const decide = (id, estado, token = adminToken) => call(`ventas/${id}/estado`, { method: 'PATCH', token, body: { estado } });
  const stock = async () => (await db.query('SELECT stock FROM libros WHERE id_libro=$1', [book.id_libro])).rows[0].stock;
  const first = await order();
  const second = await order();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.data.estado, 'Pendiente');
  assert.ok(first.data.vencePago);
  assert.equal(await stock(), 2);
  assert.equal((await order('Efectivo')).status, 400);
  const listed = (await call('ventas', { token: adminToken })).data.find(v => v.idVenta === first.data.idVenta);
  assert.equal(listed.estado, 'Pendiente');
  assert.equal(listed.vencePago, first.data.vencePago);
  assert.equal((await decide(first.data.idVenta, 'Confirmada', clientToken)).status, 403);
  const approvals = await Promise.all([1, 2].map(() => decide(first.data.idVenta, 'Confirmada')));
  assert.deepEqual(approvals.map(result => result.data.estado), ['Confirmada', 'Confirmada']);
  assert.equal(await stock(), 1);
  assert.equal((await decide(first.data.idVenta, 'Rechazada')).status, 409);
  assert.equal((await decide(second.data.idVenta, 'Rechazada')).data.estado, 'Rechazada');
  assert.equal(await stock(), 1);
  const third = await order();
  await db.query("UPDATE ventas SET fecha=fecha-INTERVAL '25 hours' WHERE id_venta=$1", [third.data.idVenta]);
  assert.equal((await decide(third.data.idVenta, 'Confirmada')).status, 409);
  const history = (await call('mis-compras', { token: clientToken })).data;
  assert.equal(history.find(v => v.idVenta === third.data.idVenta).estado, 'Vencida');
  assert.equal(history.find(v => v.idVenta === first.data.idVenta).estado, 'Confirmada');
  assert.equal((await order('Tarjeta')).data.estado, 'Completada');
  assert.equal(await stock(), 0);
});

test('receipt documents require the proper length and are available only in the admin report', async () => {
  const { rows: [book] } = await db.query('SELECT id_libro FROM libros WHERE stock>3 LIMIT 1');
  const body = { tipoComprobante: 'Boleta de venta', items: [{ idLibro: book.id_libro, cantidad: 1 }] };
  const buy = data => call('ventas', { method: 'POST', token: clientToken, body: { ...body, ...data } });
  assert.equal((await buy({ documentoComprobante: '1234', nombreComprobante: 'Ejemplo' })).status, 400);
  assert.equal((await buy({ tipoComprobante: 'Factura', documentoComprobante: '12345678', nombreComprobante: 'Ejemplo' })).status, 400);
  const sale = await buy({ documentoComprobante: '12345678', nombreComprobante: 'Ejemplo' });
  assert.equal(sale.status, 200);
  const entry = (await call('ventas', { token: adminToken })).data.find(v => v.idVenta === sale.data.idVenta);
  assert.equal(entry.documentoComprobante, '12345678');
  assert.equal(entry.nombreComprobante, 'Ejemplo');
  const own = (await call('mis-compras', { token: clientToken })).data.find(v => v.idVenta === sale.data.idVenta);
  assert.equal(own.documentoComprobante, undefined);
});

test('lookup authenticates and validates, and maps the provider response without exposing additional fields', async t => {
  const input = { tipo: 'dni', numero: '12345678' };
  const query = (body, token) => call('documento', { method: 'POST', token, body });
  assert.equal((await query(input)).status, 401);
  assert.equal((await query({ ...input, numero: '123' }, clientToken)).status, 400);
  const original = process.env.DECOLECTA_TOKEN;
  delete process.env.DECOLECTA_TOKEN;
  try {
    assert.equal((await query(input, clientToken)).status, 503);
    process.env.DECOLECTA_TOKEN = 'test-only';
    let providerStatus = 200;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      if (providerStatus !== 200) return Response.json({ error: 'Respuesta del proveedor' }, { status: providerStatus });
      if (url.pathname === '/v1/reniec/dni') {
        assert.equal(url.searchParams.get('numero'), '12345678');
        return Response.json({ full_name: 'Cliente de prueba', ignored: 'extra' });
      }
      assert.equal(url.pathname, '/v1/sunat/ruc');
      assert.equal(url.searchParams.get('numero'), '12345678901');
      return Response.json({ razon_social: 'Empresa de prueba', ignored: 'extra' });
    });
    assert.deepEqual((await query(input, clientToken)).data, { nombre: 'Cliente de prueba' });
    const ruc = { tipo: 'ruc', numero: '12345678901' };
    assert.deepEqual((await query(ruc, clientToken)).data, { nombre: 'Empresa de prueba' });
    for (const [status, document, expected] of [[400, input, 422], [422, ruc, 422], [404, input, 404], [401, input, 503], [429, ruc, 503]]) {
      providerStatus = status;
      assert.equal((await query(document, clientToken)).status, expected);
    }
  } finally {
    if (original === undefined) delete process.env.DECOLECTA_TOKEN;
    else process.env.DECOLECTA_TOKEN = original;
  }
});

test('administrator cannot remove own access and changed passwords revoke JWTs', async () => {
  const users = (await call('usuarios', { token: adminToken })).data;
  const self = users.find(user => user.rol === 'ADMIN');
  assert.equal((await call(`usuarios/${self.idUsuario}`, { method: 'PUT', token: adminToken, body: { ...self, estado: 'Inactivo' } })).status, 400);
  const customer = users.find(user => user.email === 'carlos@gmail.com');
  assert.equal((await call(`usuarios/${customer.idUsuario}`, { method: 'PUT', token: adminToken, body: { ...customer, password: 'changed123' } })).status, 200);
  assert.equal((await call('mis-compras', { token: clientToken })).status, 401);
});
test('uploaded covers survive requests and reject invalid image bytes', async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const form = new FormData(); form.set('file', new File([bytes], 'cover.png', { type: 'image/png' }));
  const upload = await call('libros/imagen', { method: 'POST', form, token: adminToken });
  assert.equal(upload.status, 200);
  const image = await handle(new Request(`https://test.invalid/api${upload.data.urlPortada}`));
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
  const bad = new FormData(); bad.set('file', new File(['not a png'], 'bad.png', { type: 'image/png' }));
  assert.equal((await call('libros/imagen', { method: 'POST', form: bad, token: adminToken })).status, 400);
});
