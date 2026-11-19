import { alMontarPagina } from '../../compartido/js/pagina.js';
import { API_URL, notificar } from '../../compartido/js/comun.js';
import { guardarSesion } from '../../compartido/js/comun.js';
import { estadoBoton, errorAcceso, limpiarErrorAcceso, celebrarAcceso } from './experiencia.js';

alMontarPagina('.login-page, .register-page', (pagina) => {
  if (new URLSearchParams(location.search).get('registro') === 'ok') { notificar('Tu cuenta está lista. Inicia sesión para continuar.'); history.replaceState(history.state, '', location.pathname); }
  const fLogin = document.getElementById('form-login');
  if (fLogin) {
    fLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errMail = document.getElementById('err-login-email');
      const errPass = document.getElementById('err-login-password');
      const btn = document.getElementById('btn-login');
      if (btn.disabled) return;
      limpiarErrorAcceso();

      if (errMail) errMail.textContent = '';
      if (errPass) errPass.textContent = '';
      document.getElementById('login-password').removeAttribute('aria-invalid');

      if (!email || !password) {
        if (!email && errMail) errMail.textContent = 'Ingresa tu correo.';
        if (!password && errPass) errPass.textContent = 'Ingresa tu contraseña.';
        return;
      }

      estadoBoton(btn, 'Verificando tu cuenta…', true);

      try {
        const res = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (pagina.signal.aborted) return;

        if (res.ok) {
          guardarSesion(data);

          estadoBoton(btn, 'Sesión iniciada', true);
          await celebrarAcceso(data.nombre);
          if (pagina.signal.aborted) return;
          window.location.href = String(data.rol).trim().toUpperCase() === 'ADMIN'
            ? '/frontend/admin/admin.html' : '/frontend/usuario/productos.html';
        } else {
          errorAcceso(data.error || 'Revisa tu correo y contraseña e inténtalo de nuevo.');
          if (errPass) errPass.textContent = data.error || 'Revisa tu correo y contraseña.';
          document.getElementById('login-password').setAttribute('aria-invalid', 'true');
          estadoBoton(btn, 'Iniciar sesión');
          document.getElementById('login-password').focus();
        }
      } catch (err) {
        if (pagina.signal.aborted) return;
        errorAcceso('No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.');
        estadoBoton(btn, 'Iniciar sesión');
      }
    });
  }

  const fRegister = document.getElementById('form-register');
  if (fRegister) {
    fRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('reg-nombre').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const btn = document.getElementById('btn-register');
      if (btn.disabled) return;
      limpiarErrorAcceso();

      if (!nombre || !email || password.length < 6) {
        notificar('Revisa los campos (contraseña mín. 6 caracteres).');
        return;
      }

      estadoBoton(btn, 'Creando tu cuenta…', true);

      try {
        const res = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email, password })
        });
        const data = await res.json();
        if (pagina.signal.aborted) return;

        if (res.ok) {
          estadoBoton(btn, 'Cuenta creada', true);
          await celebrarAcceso(nombre, true);
          if (pagina.signal.aborted) return;
          window.location.href = '/frontend/auth/login.html?registro=ok';
        } else {
          errorAcceso(data.error || 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.');
          estadoBoton(btn, 'Crear mi cuenta');
        }
      } catch (err) {
        if (pagina.signal.aborted) return;
        errorAcceso('No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.');
        estadoBoton(btn, 'Crear mi cuenta');
      }
    });
  }
});
