import { alMontarPagina } from '../../compartido/js/pagina.js';
import { requiereAdmin, sesion, notificar, limpiarSesion } from '../../compartido/js/comun.js';
import { solicitar } from '../../compartido/js/api.js';
import { animarEntrada, escapar, abrirModal, cerrarModal } from '../../compartido/js/interfaz.js';

alMontarPagina('#users-table', vista => {
  if (!requiereAdmin()) return;
  let usuarios = [], roles = [], pagina = 0, peticion = 0, correoAnterior = '';
  const tabla = document.getElementById('users-table'), form = document.getElementById('user-form');
  const feedback = document.getElementById('users-feedback'), errores = document.getElementById('user-errors');
  const refresh = document.getElementById('users-refresh'), crear = document.getElementById('user-create');
  const campo = id => document.getElementById(`user-${id}`);
  function render() {
    const query = document.getElementById('users-search').value.trim().toLocaleLowerCase('es');
    const rol = document.getElementById('users-role').value, estado = document.getElementById('users-state').value;
    const filtrados = usuarios.filter(u => `${u.nombre} ${u.email}`.toLocaleLowerCase('es').includes(query) && (!rol || u.rol === rol) && (!estado || u.estado === estado));
    pagina = Math.max(0, Math.min(pagina, Math.ceil(filtrados.length / 10) - 1));
    document.getElementById('users-total').textContent = usuarios.length;
    document.getElementById('users-active').textContent = usuarios.filter(u => u.estado === 'Activo').length;
    document.getElementById('users-admin').textContent = usuarios.filter(u => u.estado === 'Activo' && u.rol === 'ADMIN').length;
    document.getElementById('users-count').textContent = `${filtrados.length} ${filtrados.length === 1 ? 'cuenta' : 'cuentas'} encontradas`;
    tabla.replaceChildren();
    if (!filtrados.length) tabla.innerHTML = '<tr><td colspan="5" class="empty-table-cell">No hay usuarios que coincidan con los filtros.</td></tr>';
    filtrados.slice(pagina * 10, (pagina + 1) * 10).forEach(u => {
      const tr = document.createElement('tr');
      const iniciales = u.nombre.split(/\s+/).slice(0, 2).map(n => n[0]).join('');
      tr.innerHTML = `<td><div class="person-cell"><span class="user-avatar" aria-hidden="true">${escapar(iniciales)}</span><div><strong>${escapar(u.nombre)}</strong>${String(u.idUsuario) === sesion.id ? '<br><small>Tu cuenta</small>' : ''}</div></div></td><td>${escapar(u.email)}</td><td>${u.rol === 'ADMIN' ? 'Administrador' : 'Cliente'}</td><td><span class="status-tag ${u.estado === 'Activo' ? 'activo' : 'inactivo'}">${escapar(u.estado)}</span></td><td><button type="button" class="btn-action-edit" aria-label="Editar a ${escapar(u.nombre)}">Editar</button></td>`;
      tr.querySelector('button').addEventListener('click', () => editar(u)); tabla.appendChild(tr);
    });
    document.getElementById('users-page').textContent = filtrados.length ? `${pagina * 10 + 1}–${Math.min((pagina + 1) * 10, filtrados.length)} de ${filtrados.length}` : 'Sin resultados';
    document.getElementById('users-prev').disabled = pagina === 0;
    document.getElementById('users-next').disabled = (pagina + 1) * 10 >= filtrados.length;
    animarEntrada(tabla.children);
  }
  function limpiarErrores() {
    errores.hidden = true; errores.replaceChildren();
    ['name', 'email', 'password'].forEach(id => { campo(id).removeAttribute('aria-invalid'); campo(`${id}-error`).textContent = ''; });
  }
  function mostrarErrores(lista) {
    errores.hidden = false;
    errores.innerHTML = '<strong>Revisa los datos antes de guardar.</strong><ul>' + lista.map(([id, mensaje]) => `<li>${id ? `<a href="#user-${id}">${escapar(mensaje)}</a>` : escapar(mensaje)}</li>`).join('') + '</ul>';
    lista.forEach(([id, mensaje]) => { if (id && campo(`${id}-error`)) { campo(id).setAttribute('aria-invalid', 'true'); campo(`${id}-error`).textContent = mensaje; } });
    errores.focus();
  }
  function editar(usuario = null) {
    form.reset(); limpiarErrores();
    campo('id').value = usuario?.idUsuario || ''; correoAnterior = usuario?.email || '';
    campo('name').value = usuario?.nombre || ''; campo('email').value = usuario?.email || '';
    campo('role').replaceChildren(...roles.map(r => new Option(r.nombre === 'ADMIN' ? 'Administrador' : 'Cliente', r.idRol)));
    campo('role').value = usuario?.idRol || roles.find(r => r.nombre === 'CLIENTE')?.idRol || '';
    campo('state').value = usuario?.estado || 'Activo';
    const propio = String(usuario?.idUsuario) === sesion.id;
    campo('role').disabled = propio; campo('state').disabled = propio; campo('self-note').hidden = !propio;
    campo('password').required = !usuario; campo('password-label').textContent = usuario ? '(opcional)' : '(obligatoria)';
    campo('modal-title').textContent = usuario ? 'Editar usuario' : 'Nuevo usuario';
    abrirModal('modal-usuario');
  }
  async function cargar() {
    const request = ++peticion; refresh.disabled = true; crear.disabled = true; feedback.hidden = true;
    try {
      const [cuentas, perfiles] = await Promise.all([solicitar('usuarios', {}, vista.fetch), solicitar('roles', {}, vista.fetch)]);
      if (vista.signal.aborted || request !== peticion) return;
      usuarios = cuentas; roles = perfiles.filter(r => ['ADMIN', 'CLIENTE'].includes(r.nombre)); render(); crear.disabled = false;
    } catch (error) {
      if (vista.signal.aborted) return;
      feedback.hidden = false; feedback.textContent = error.message;
      tabla.innerHTML = '<tr><td colspan="5" class="empty-table-cell">No pudimos cargar los usuarios. Usa Actualizar para reintentar.</td></tr>';
    } finally { if (!vista.signal.aborted) refresh.disabled = false; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = campo('save'); if (button.disabled) return;
    limpiarErrores(); const lista = [];
    if (!campo('name').value.trim()) lista.push(['name', 'Ingresa el nombre completo.']);
    if (!campo('email').validity.valid || !campo('email').value.trim()) lista.push(['email', 'Ingresa un correo válido.']);
    const password = campo('password').value;
    if ((!campo('id').value || password) && (password.trim().length === 0 || password.length < 6 || new TextEncoder().encode(password).length > 72)) lista.push(['password', 'Usa al menos 6 caracteres y como máximo 72 bytes.']);
    if (lista.length) { mostrarErrores(lista); return; }
    button.disabled = true; button.textContent = 'Guardando…';
    const id = campo('id').value;
    const datos = { nombre: campo('name').value.trim(), email: campo('email').value.trim(), idRol: Number(campo('role').value), estado: campo('state').value, password };
    try {
      await solicitar(id ? `usuarios/${id}` : 'usuarios', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      if (vista.signal.aborted) return;
      cerrarModal('modal-usuario'); notificar(id ? 'Usuario actualizado.' : 'Usuario registrado.');
      if (id === sesion.id && (password || datos.email.toLowerCase() !== correoAnterior.toLowerCase())) { limpiarSesion(); location.replace('/frontend/auth/login.html'); return; }
      if (id === sesion.id) { sessionStorage.setItem('usuarioLogueado', datos.nombre); location.reload(); return; }
      await cargar();
    } catch (error) {
      if (!vista.signal.aborted) {
        const key = error.message.startsWith('email:') ? 'email' : error.message.startsWith('password:') ? 'password' : error.message.startsWith('nombre:') ? 'name' : '';
        mostrarErrores([[key, error.message]]);
      }
    } finally { button.disabled = false; button.textContent = 'Guardar usuario'; }
  });
  crear.addEventListener('click', () => editar()); refresh.addEventListener('click', cargar);
  ['close', 'cancel'].forEach(id => campo(id).addEventListener('click', () => cerrarModal('modal-usuario')));
  ['users-search', 'users-role', 'users-state'].forEach(id => document.getElementById(id).addEventListener(id === 'users-search' ? 'input' : 'change', () => { pagina = 0; render(); }));
  document.getElementById('users-prev').addEventListener('click', () => { --pagina; render(); });
  document.getElementById('users-next').addEventListener('click', () => { ++pagina; render(); });
  return cargar();
});
