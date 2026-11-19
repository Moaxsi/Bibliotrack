import { alMontarPagina } from './pagina.js';
export const API_URL = `${window.location.origin}/api`;
export const rutas = Object.freeze({
  inicio: '/index.html',
  catalogo: '/frontend/usuario/productos.html',
  login: '/frontend/auth/login.html',
  admin: '/frontend/admin/admin.html'
});
const clavesSesion = ['idUsuario', 'usuarioLogueado', 'emailUsuario', 'rolUsuario', 'token'];

export function limpiarSesion() {
  clavesSesion.forEach(clave => {
    sessionStorage.removeItem(clave);
    localStorage.removeItem(clave);
  });
}

clavesSesion.forEach(clave => localStorage.removeItem(clave));
if (new URLSearchParams(window.location.search).get('modo') === 'invitado') {
  limpiarSesion();
  history.replaceState(null, '', window.location.pathname);
}

const id = sessionStorage.getItem('idUsuario');
const nombre = sessionStorage.getItem('usuarioLogueado');
const token = sessionStorage.getItem('token');
const rol = (sessionStorage.getItem('rolUsuario') || '').trim().toUpperCase();
const identificada = Boolean(id && nombre && token && ['ADMIN', 'CLIENTE'].includes(rol));
export const sesion = Object.freeze({
  id: identificada ? id : null,
  nombre: identificada ? nombre : null,
  rol: identificada ? rol : null,
  esAdmin: identificada && rol === 'ADMIN'
});

export function guardarSesion(usuario) {
  limpiarSesion();
  sessionStorage.setItem('idUsuario', usuario.idUsuario);
  sessionStorage.setItem('usuarioLogueado', usuario.nombre);
  sessionStorage.setItem('emailUsuario', usuario.email);
  sessionStorage.setItem('rolUsuario', String(usuario.rol).trim().toUpperCase());
  sessionStorage.setItem('token', usuario.token);
}

export function fetchConToken(url, opciones = {}, lector = fetch) {
  const headers = new Headers(opciones.headers || {});
  const token = sessionStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return lector(url, { ...opciones, headers });
}

export function requiereAdmin() {
  if (sesion.esAdmin) return true;
  window.location.replace(rutas.login);
  return false;
}

export function notificar(msg) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast-item';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('show'), 20);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

window.cerrarSesion = function() {
  limpiarSesion();
  localStorage.removeItem('bibliotrack_cart');
  window.location.href = rutas.inicio;
};

alMontarPagina('body', (pagina) => {
  const navegacion = document.querySelector('.main-navbar .navbar-links');
  if (navegacion) {
    const opciones = sesion.esAdmin
      ? [
          ['Catálogo', rutas.catalogo],
          ['Inventario', rutas.admin],
          ['Reporte', '/frontend/admin/ventas.html'],
          ['Usuarios', '/frontend/admin/usuarios.html']
        ]
      : [
          ['Catálogo', rutas.catalogo],
          ['Historial', '/frontend/usuario/historial.html'],
          ['Contacto', '/frontend/usuario/contacto.html']
        ];
    navegacion.replaceChildren(...opciones.map(([texto, destino]) => {
      const enlace = document.createElement('a');
      const activa = location.pathname === destino;
      enlace.href = destino;
      enlace.textContent = texto;
      enlace.className = activa ? 'nav-link active' : 'nav-link';
      if (activa) enlace.setAttribute('aria-current', 'page');
      return enlace;
    }));
  }
  const auth = document.getElementById('auth-buttons-wrapper');
  if (auth) {
    auth.replaceChildren();
    if (sesion.nombre) {
      const saludo = document.createElement('span');
      saludo.className = 'user-greeting';
      saludo.textContent = sesion.nombre;
      const perfil = document.createElement('div');
      perfil.className = 'user-profile';
      const avatar = document.createElement('span');
      avatar.className = 'user-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = sesion.nombre.split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
      const detalle = document.createElement('span');
      detalle.className = 'user-profile-copy';
      const rol = document.createElement('small');
      rol.textContent = sesion.esAdmin ? 'Administración' : 'Tu espacio de lectura';
      detalle.append(rol, saludo);
      perfil.append(avatar, detalle);
      const salir = document.createElement('button');
      salir.type = 'button';
      salir.className = 'btn-logout';
      salir.textContent = 'Salir';
      salir.onclick = window.cerrarSesion;
      auth.append(perfil, salir);
    } else {
      const login = document.createElement('a');
      login.href = rutas.login;
      login.className = 'btn-nav-login';
      login.textContent = 'Iniciar Sesión';
      auth.appendChild(login);
    }
  }
  const contador = document.getElementById('cart-counter');
  if (contador) {
    try {
      const carrito = JSON.parse(localStorage.getItem('bibliotrack_cart')) || [];
      contador.textContent = carrito.reduce((total, item) => total + item.cantidad, 0);
    } catch {
      contador.textContent = '0';
    }
  }
});
