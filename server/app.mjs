import { database } from './db.mjs';
import { authenticate, login, userSelect } from './auth.mjs';
import { catalog, deleteBook, getBook, saveBook } from './catalog.mjs';
import { saveUser, userView } from './users.mjs';
import { decideYapeSale, registerSale, saleDates, saleDetail, saleView } from './sales.mjs';
import { readImage, uploadImage } from './images.mjs';
import { lookupDocument } from './documents.mjs';
import { email, fail, integer, text } from './rules.mjs';

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export function createApp(getDb = database) {
  return async function handle(request) {
    try {
      const url = new URL(request.url);
      const route = (url.searchParams.get('route') || url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
      const method = request.method;
      const db = getDb();
      const body = async () => {
        const declared = Number(request.headers.get('content-length') || 0);
        if (declared > 1100000) fail('La solicitud es demasiado grande', 413);
        if (!request.headers.get('content-type')?.includes('application/json')) fail('Envía los datos en formato JSON', 415);
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 1100000) fail('La solicitud es demasiado grande', 413);
        let data;
        try { data = JSON.parse(raw); } catch { fail('El JSON no es válido'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Los datos no son válidos');
        return data;
      };
      if (method === 'GET' && route.startsWith('uploads/')) return readImage(db, route.slice(8));
      if (route === 'login' && method === 'POST') return json(await login(db, await body()));
      if (route === 'register' && method === 'POST') {
        const user = await saveUser(db, null, await body(), null, true);
        return json({ mensaje: 'Usuario registrado exitosamente', idUsuario: user.idUsuario });
      }
      if (route === 'categorias' && method === 'GET') {
        const { rows } = await db.query('SELECT id_categoria AS "idCategoria",nombre,descripcion FROM categorias ORDER BY id_categoria');
        return json(rows);
      }
      if (route === 'libros' && method === 'GET') return json(await catalog(db, url.searchParams));
      if (/^libros\/\d+$/.test(route) && method === 'GET') return json(await getBook(db, integer(route.split('/')[1], 'idLibro')));
      if (route === 'contacto' && method === 'POST') {
        const data = await body();
        await db.query('INSERT INTO contacto (nombre,email,asunto,mensaje) VALUES ($1,$2,$3,$4)', [text(data, 'nombre', 100), email(data), text(data, 'asunto', 200), text(data, 'mensaje', 10000)]);
        return json({ mensaje: 'Mensaje recibido correctamente. Te responderemos a la brevedad.' });
      }
      const own = route === 'mis-compras' || /^mis-compras\/\d+\/detalle$/.test(route) || ['ventas', 'documento'].includes(route) && method === 'POST';
      const user = await authenticate(db, request, !own);
      if (route === 'libros/imagen' && method === 'POST') return json(await uploadImage(db, request));
      if (route === 'libros' && method === 'POST') return json(await saveBook(db, null, await body()));
      if (/^libros\/\d+(?:\/estado)?$/.test(route)) {
        const id = integer(route.split('/')[1], 'idLibro');
        if (method === 'DELETE' && !route.endsWith('/estado')) return json(await deleteBook(db, id));
        if (method === 'PUT') {
          let data = await body();
          const stateOnly = route.endsWith('/estado');
          if (stateOnly) data = { estado: text(data, 'estado', 20) };
          const book = await saveBook(db, id, data);
          return json(stateOnly ? { mensaje: 'Estado actualizado correctamente', estado: book.estado } : book);
        }
      }
      if (route === 'usuarios' && method === 'GET') return json((await db.query(`${userSelect} ORDER BY u.id_usuario DESC`)).rows.map(userView));
      if (route === 'roles' && method === 'GET') return json((await db.query('SELECT id_rol AS "idRol",nombre,descripcion FROM roles ORDER BY id_rol')).rows);
      if (route === 'usuarios' && method === 'POST') return json(await saveUser(db, null, await body(), user.id_usuario));
      if (/^usuarios\/\d+$/.test(route) && method === 'PUT') return json(await saveUser(db, integer(route.split('/')[1], 'idUsuario'), await body(), user.id_usuario));
      if (route === 'documento' && method === 'POST') return json(await lookupDocument(await body()));
      if (/^ventas\/\d+\/estado$/.test(route) && method === 'PATCH') {
        const id = integer(route.split('/')[1], 'idVenta');
        return json(await decideYapeSale(db, id, (await body()).estado));
      }
      if (route === 'ventas' && method === 'POST') return json(await registerSale(db, await body(), user));
      if (route === 'ventas' && method === 'GET') return json((await db.query(`SELECT v.*,${saleDates},u.nombre AS cliente_nombre,u.email AS cliente_email FROM ventas v JOIN usuarios u USING (id_usuario) ORDER BY v.id_venta DESC`)).rows.map(saleView));
      if (route === 'mis-compras' && method === 'GET') return json((await db.query(`SELECT *,${saleDates} FROM ventas WHERE id_usuario=$1 ORDER BY id_venta DESC`, [user.id_usuario])).rows.map(saleView));
      if (/^(ventas|mis-compras)\/\d+\/detalle$/.test(route) && method === 'GET') {
        const id = integer(route.split('/')[1], 'idVenta');
        if (route.startsWith('mis-compras/') && !(await db.query('SELECT 1 FROM ventas WHERE id_venta=$1 AND id_usuario=$2', [id, user.id_usuario])).rowCount) fail('Compra no encontrada', 404);
        return json(await saleDetail(db, id));
      }
      fail('Ruta no encontrada', 404);
    } catch (error) {
      if (error.status) return json({ error: error.message }, error.status);
      if (error.code === '23505') return json({ error: 'El correo o ISBN ya se encuentra registrado.' }, 409);
      if (['23503', '23514', '22001', '22003'].includes(error.code)) return json({ error: 'Revisa los datos y sus relaciones antes de guardar.' }, 400);
      console.error('API error', error.code || error.name);
      return json({ error: 'No se pudo completar la operación. Vuelve a intentarlo.' }, 500);
    }
  };
}
