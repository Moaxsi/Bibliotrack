import { choice, fail } from './rules.mjs';

export async function lookupDocument(data) {
  const tipo = choice(data.tipo, ['dni', 'ruc'], 'tipo');
  const digits = tipo === 'dni' ? 8 : 11;
  if (typeof data.numero !== 'string' || !new RegExp(`^[0-9]{${digits}}$`).test(data.numero)) {
    fail(`Ingresa los ${digits} dígitos del ${tipo.toUpperCase()}.`);
  }
  const token = process.env.DECOLECTA_TOKEN?.trim();
  if (!token) fail('La consulta de documentos no está disponible. Elige boleta simple o intenta más tarde.', 503);

  const resource = tipo === 'dni' ? 'reniec/dni' : 'sunat/ruc';
  const url = new URL(`https://api.decolecta.com/v1/${resource}`);
  url.searchParams.set('numero', data.numero);
  let response;
  let result;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) result = await response.json();
  } catch {
    fail('No se pudo consultar el documento. Vuelve a intentarlo.', 502);
  }
  if (response.status === 404) fail('No encontramos un nombre para ese documento.', 404);
  if (!response.ok) fail('La consulta de documentos está temporalmente fuera de servicio.', 502);
  const field = key => typeof result?.[key] === 'string' ? result[key].trim() : '';
  const nombre = tipo === 'dni'
    ? field('full_name') || ['first_name', 'first_last_name', 'second_last_name'].map(field).filter(Boolean).join(' ')
    : field('razon_social') || field('nombre_o_razon_social');
  if (!nombre) fail('No encontramos un nombre para ese documento.', 404);
  if (nombre.length > 200) fail('El proveedor devolvió un nombre que no se puede usar.', 502);
  return { nombre };
}
