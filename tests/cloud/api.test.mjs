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
  db = new pg.Pool({ ...config, database: name });
  await db.query(await readFile(new URL('../../ica/sql/migracion_01_implementacionBD.sql', import.meta.url), 'utf8'));
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
