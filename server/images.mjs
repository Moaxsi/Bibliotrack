import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { fail } from './rules.mjs';

export async function uploadImage(db, request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) fail('Selecciona una imagen válida');
  const form = await request.formData().catch(() => fail('El archivo seleccionado no es válido'));
  const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > 1024 * 1024) fail('Selecciona una imagen válida de hasta 1 MB');
  if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) fail('Formato no permitido. Usa JPG, PNG o GIF');
  const data = Buffer.from(await file.arrayBuffer());
  let format;
  try {
    const metadata = await sharp(data, { limitInputPixels: 25000000 }).metadata();
    format = metadata.format;
    if (!metadata.width || !metadata.height || !['jpeg', 'png', 'gif'].includes(format)) fail('El archivo seleccionado no es una imagen válida');
    // Decode and re-encode before storing to reject corrupt files and discard metadata.
    const normalized = await sharp(data, { limitInputPixels: 25000000 }).rotate().toFormat(format).toBuffer();
    if (normalized.length > 1024 * 1024) fail('La imagen procesada supera 1 MB');
    const id = randomUUID();
    const type = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    await db.query('INSERT INTO portadas_cloud (id,content_type,contenido) VALUES ($1,$2,$3)', [id, type, normalized]);
    return { urlPortada: `/uploads/${id}` };
  } catch (error) {
    if (error.status || error.code) throw error;
    fail('El archivo seleccionado no es una imagen válida');
  }
}
export async function readImage(db, id) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/.test(id)) fail('Imagen no encontrada', 404);
  const { rows: [image] } = await db.query('SELECT content_type,contenido FROM portadas_cloud WHERE id=$1', [id]);
  if (!image) fail('Imagen no encontrada', 404);
  return new Response(image.contenido, { headers: { 'Content-Type': image.content_type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public,max-age=31536000,immutable' } });
}
