import { alMontarPagina } from '../../compartido/js/pagina.js';
import { API_URL, rutas, sesion, notificar } from '../../compartido/js/comun.js';

alMontarPagina('#form-contacto', (pagina) => {
  window.enviarMensajeContacto = async function(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const nombre = document.getElementById('cont-nombre').value.trim();
    const email = document.getElementById('cont-email').value.trim();
    const asunto = document.getElementById('cont-asunto').value;
    const mensaje = document.getElementById('cont-mensaje').value.trim();
    const btn = document.getElementById('btn-enviar-contacto');

    if (!asunto) {
      notificar('Por favor selecciona un motivo.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando tu mensaje…';

    try {
      const res = await fetch(`${API_URL}/contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, asunto, mensaje })
      });

      const data = await res.json();
      if (res.ok) {
        notificar(data.mensaje || 'Mensaje enviado con éxito.');
        form.reset();
      } else {
        notificar(data.error || 'No se pudo enviar el mensaje.');
      }
    } catch (err) {
      notificar('Error de conexión con el servidor.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar Mensaje';
    }
  };
});
