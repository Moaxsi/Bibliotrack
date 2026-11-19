import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fail } from './rules.mjs';

export const credential = hash => createHash('sha256').update(hash || '').digest('hex');
export const userSelect = `SELECT u.*, r.nombre AS rol FROM usuarios u JOIN roles r USING (id_rol)`;
export function secret() {
  const value = process.env.BIBLIOTRACK_JWT_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new Error('JWT secret is not configured');
  return value;
}
export function identity(user) {
  return { idUsuario: user.id_usuario, nombre: user.nombre, email: user.email, rol: user.rol.toUpperCase() };
}
export async function login(db, data) {
  if (typeof data.email !== 'string' || typeof data.password !== 'string' || data.email.length > 150 || Buffer.byteLength(data.password) > 72) fail('Email y contraseña son obligatorios');
  const { rows: [user] } = await db.query(`${userSelect} WHERE lower(u.email)=lower($1)`, [data.email.trim()]);
  if (!user || !await bcrypt.compare(data.password, user.password)) fail('Credenciales incorrectas', 401);
  if (user.estado !== 'Activo') fail('Usuario inactivo o suspendido', 403);
  return { ...identity(user), token: jwt.sign({ idUsuario: String(user.id_usuario), roles: [user.rol.toUpperCase()], credencial: credential(user.password) }, secret(), { algorithm: 'HS256', expiresIn: '1h', issuer: 'bibliotrack', subject: user.email }) };
}
export async function authenticate(db, request, admin = false) {
  let claims;
  try {
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
    if (!token) fail('Inicia sesión para continuar', 401);
    claims = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: 'bibliotrack' });
  } catch { fail('Tu sesión terminó. Inicia sesión nuevamente.', 401); }
  const { rows: [user] } = await db.query(`${userSelect} WHERE u.email=$1`, [claims.sub]);
  if (!user || user.estado !== 'Activo' || String(user.id_usuario) !== claims.idUsuario || credential(user.password) !== claims.credencial || !Array.isArray(claims.roles) || claims.roles.length !== 1 || claims.roles[0] !== user.rol.toUpperCase()) fail('La cuenta o sus permisos cambiaron. Inicia sesión nuevamente.', 401);
  if (admin && user.rol.toUpperCase() !== 'ADMIN') fail('No tienes permiso para esta operación.', 403);
  if (!['ADMIN', 'CLIENTE'].includes(user.rol.toUpperCase())) fail('No tienes permiso para esta operación.', 403);
  return user;
}
