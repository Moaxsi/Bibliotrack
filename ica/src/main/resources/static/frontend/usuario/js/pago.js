import { solicitar } from '../../compartido/js/api.js';
import { sesion } from '../../compartido/js/comun.js';

const digitos = valor => valor.replace(/[^0-9]/g, '');

export function marcaTarjeta(numero) {
  if (numero.startsWith('4')) return 'Visa';
  const prefijo = Number(numero.slice(0, 4));
  if (/^5[1-5]/.test(numero) || numero.length >= 4 && prefijo >= 2221 && prefijo <= 2720) return 'Mastercard';
  return '';
}

export function configurarPago(lector) {
  const campo = id => document.getElementById(id);
  const metodo = campo('order-metodo-pago'), comprobante = campo('order-tipo-comprobante');
  const tarjeta = campo('checkout-card'), documento = campo('checkout-document');
  const numero = campo('card-number'), titular = campo('card-holder'), vence = campo('card-expiry'), cvv = campo('card-cvv');
  const logos = [...campo('card-brand').querySelectorAll('img')];
  const identificador = campo('receipt-document'), nombre = campo('receipt-name');
  const ayuda = campo('receipt-feedback');
  let consulta;
  let temporal = 0;
  let nombreEditado = false;

  function mostrarTarjeta(valor) {
    numero.value = valor.match(/.{1,4}/g)?.join(' ') || '';
    numero.setCustomValidity('');
    const marca = marcaTarjeta(valor);
    for (const logo of logos) logo.hidden = logo.alt !== marca;
  }

  function actualizarPago() {
    tarjeta.hidden = tarjeta.disabled = metodo.value !== 'Tarjeta';
    campo('checkout-yape-hint').hidden = metodo.value !== 'Yape';
    if (tarjeta.hidden) {
      mostrarTarjeta('');
      titular.value = '';
      vence.value = '';
      cvv.value = '';
    }
  }

  numero.addEventListener('input', () => {
    const valor = digitos(numero.value).slice(0, 16);
    const cursor = digitos(numero.value.slice(0, numero.selectionStart)).length;
    const quitarEspacio = numero.value.endsWith(' ');
    mostrarTarjeta(valor);
    const destino = cursor + Math.floor(Math.max(cursor - 1, 0) / 4);
    if (!quitarEspacio) numero.setSelectionRange(destino, destino);
  });

  const tipoDocumento = () => comprobante.value === 'Factura' ? 'ruc' : 'dni';
  const longitud = () => tipoDocumento() === 'ruc' ? 11 : 8;
  const etiquetaDocumento = () => tipoDocumento().toUpperCase();
  const avisoLongitud = () => `Ingresa ${longitud()} dígitos para el ${etiquetaDocumento()}.`;
  function mensaje(texto = '', { error = false, invalido = false, soloLectores = false } = {}) {
    ayuda.toggleAttribute('data-error', error);
    ayuda.classList.toggle('sr-only', soloLectores);
    if (invalido) identificador.setAttribute('aria-invalid', 'true');
    else identificador.removeAttribute('aria-invalid');
    ayuda.textContent = texto;
  }

  function limpiarDocumento() {
    clearTimeout(temporal);
    consulta?.abort();
    consulta = undefined;
    nombre.value = '';
    nombre.placeholder = 'Se completa automáticamente o escríbelo';
    nombre.setCustomValidity('');
    identificador.setCustomValidity('');
    mensaje();
  }

  function actualizarDocumento() {
    limpiarDocumento();
    nombreEditado = false;
    documento.hidden = documento.disabled = comprobante.value === 'Boleta';
    identificador.value = '';
    identificador.placeholder = `${longitud()} dígitos`;
    campo('receipt-document-label').textContent = etiquetaDocumento();
    campo('receipt-name-label').textContent = tipoDocumento() === 'ruc' ? 'Razón social' : 'Nombre completo';
  }

  async function buscar() {
    const valor = identificador.value;
    if (!sesion.id) { mensaje('Inicia sesión para consultar.', { error: true }); return; }
    const actual = new AbortController();
    consulta = actual;
    mensaje(`Consultando ${etiquetaDocumento()}…`);
    try {
      const datos = await solicitar('documento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoDocumento(), numero: valor }), signal: actual.signal
      }, lector);
      if (actual.signal.aborted) return;
      if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) throw new Error();
      if (!nombreEditado) nombre.value = datos.nombre;
      identificador.setCustomValidity('');
      mensaje(tipoDocumento() === 'ruc' ? 'Razón social encontrada.' : 'Nombre encontrado.', { soloLectores: true });
    } catch (error) {
      if (actual.signal.aborted) return;
      identificador.setCustomValidity('');
      if (error.status === 404) {
        mensaje(`${etiquetaDocumento()} no encontrado. Revisa el número.`, { error: true, invalido: true });
      } else if (error.status === 400 || error.status === 422) {
        mensaje(`Revisa el número de ${etiquetaDocumento()}.`, { error: true, invalido: true });
      } else {
        const etiqueta = tipoDocumento() === 'ruc' ? 'la razón social' : 'el nombre completo';
        nombre.placeholder = `Escribe ${etiqueta}`;
        mensaje('Consulta no disponible.', { error: true });
      }
    } finally {
      if (consulta === actual) consulta = undefined;
    }
  }

  identificador.addEventListener('input', () => {
    const anterior = nombreEditado ? nombre.value : '';
    limpiarDocumento();
    nombre.value = anterior;
    const valor = digitos(identificador.value);
    if (valor !== identificador.value) identificador.value = valor;
    if (identificador.value.length === longitud()) temporal = setTimeout(buscar, 280);
    if (identificador.value.length > longitud()) mensaje(avisoLongitud(), { error: true, invalido: true });
  });
  identificador.addEventListener('blur', () => {
    if (identificador.value && identificador.value.length < longitud()) {
      mensaje(avisoLongitud(), { error: true, invalido: true });
    }
  });
  nombre.addEventListener('input', () => { nombreEditado = true; nombre.setCustomValidity(''); });
  metodo.addEventListener('change', actualizarPago);
  comprobante.addEventListener('change', actualizarDocumento);
  actualizarPago();
  actualizarDocumento();

  return {
    validar() {
      if (!documento.hidden) {
        if (identificador.value.length !== longitud()) {
          mensaje(avisoLongitud(), { error: true, invalido: true });
          identificador.setCustomValidity(avisoLongitud());
        } else {
          nombre.setCustomValidity(nombre.value.trim() ? '' : 'Completa este dato del comprobante.');
        }
      }
    },
    datos() {
      return {
        metodoPago: metodo.value,
        tipoComprobante: comprobante.value,
        ...(!documento.hidden ? { documentoComprobante: identificador.value, nombreComprobante: nombre.value.trim() } : {})
      };
    },
    finalizar() {
      mostrarTarjeta('');
      titular.value = '';
      vence.value = '';
      cvv.value = '';
      actualizarDocumento();
    },
    salir() { mostrarTarjeta(''); titular.value = ''; vence.value = ''; cvv.value = ''; limpiarDocumento(); }
  };
}
