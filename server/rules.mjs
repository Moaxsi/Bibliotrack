export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (message, status = 400) => { throw new HttpError(status, message); };

export function text(data, key, max) {
  const value = data[key];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${key}: ingresa un valor de hasta ${max} caracteres`);
  return value.trim();
}
export function integer(value, field, min = 1) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') fail(`${field}: ingresa un número entero mayor o igual a ${min}`);
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > 2147483647) fail(`${field}: ingresa un número entero mayor o igual a ${min}`);
  return number;
}
// Integer cents preserve the Java BigDecimal contract for totals and stock updates.
export function cents(value, field = 'precioVenta') {
  if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d{1,2}0*)?$/.test(String(value))) fail(`${field}: ingresa un importe positivo con hasta dos decimales`);
  const number = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 9999999999) fail(`${field}: ingresa un importe positivo con hasta dos decimales`);
  return number;
}
export function email(data) {
  const value = text(data, 'email', 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail('email: ingresa un correo válido');
  return value;
}
export function password(value) {
  if (typeof value !== 'string' || !value.trim() || value.length < 6 || Buffer.byteLength(value) > 72) fail('password: usa al menos 6 caracteres y como máximo 72 bytes');
  return value;
}
export function optional(data, key, max) {
  if (data[key] == null) return '';
  if (typeof data[key] !== 'string' || data[key].length > max) fail(`${key}: el texto es demasiado largo`);
  return data[key].trim();
}
export function choice(value, options, field) {
  if (!options.includes(value)) fail(`${field}: selecciona una opción válida`);
  return value;
}
