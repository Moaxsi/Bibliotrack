import bcrypt from 'bcryptjs';
import { transaction } from './db.mjs';
import { userSelect } from './auth.mjs';
import { choice, email, fail, integer, password, text } from './rules.mjs';

export const userView = row => ({ idUsuario: row.id_usuario, nombre: row.nombre, email: row.email, idRol: row.id_rol, rol: row.rol, estado: row.estado, fechaCreacion: row.fecha_creacion });
export async function saveUser(db, id, data, actor, registration = false) {
  const name = text(data, 'nombre', 100), mail = email(data);
  const hash = !id || data.password ? await bcrypt.hash(password(data.password), 10) : null;
  return transaction(db, async client => {
    let current;
    let all = [];
    if (id) {
      all = (await client.query(`${userSelect} ORDER BY u.id_usuario FOR UPDATE OF u`)).rows;
      current = all.find(user => user.id_usuario === id);
      if (!current) fail('Usuario no encontrado', 404);
    }
    const duplicate = await client.query('SELECT 1 FROM usuarios WHERE lower(email)=$1 AND ($2::integer IS NULL OR id_usuario<>$2)', [mail, id]);
    if (duplicate.rowCount) fail('email: el correo ya se encuentra registrado');
    const { rows: [role] } = registration
      ? await client.query("SELECT * FROM roles WHERE upper(nombre)='CLIENTE'")
      : await client.query('SELECT * FROM roles WHERE id_rol=$1', [integer(data.idRol, 'idRol')]);
    if (!role || !['ADMIN', 'CLIENTE'].includes(role.nombre.toUpperCase())) fail('idRol: selecciona un rol válido');
    const state = registration ? 'Activo' : choice(data.estado, ['Activo', 'Inactivo', 'Suspendido'], 'estado');
    const removesAdmin = role.nombre.toUpperCase() !== 'ADMIN' || state !== 'Activo';
    if (id != null && id === actor && removesAdmin) fail('No puedes quitar tu propio acceso de administrador');
    if (current?.rol.toUpperCase() === 'ADMIN' && current.estado === 'Activo' && removesAdmin && all.filter(user => user.rol.toUpperCase() === 'ADMIN' && user.estado === 'Activo').length <= 1) fail('Debe permanecer al menos un administrador activo');
    const args = [name, mail, hash || current?.password, role.id_rol, state];
    const { rows: [saved] } = id
      ? await client.query('UPDATE usuarios SET nombre=$1,email=$2,password=$3,id_rol=$4,estado=$5 WHERE id_usuario=$6 RETURNING *', [...args, id])
      : await client.query('INSERT INTO usuarios (nombre,email,password,id_rol,estado) VALUES ($1,$2,$3,$4,$5) RETURNING *', args);
    return userView({ ...saved, rol: role.nombre });
  });
}
