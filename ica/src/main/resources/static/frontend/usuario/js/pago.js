import { solicitar } from '../../compartido/js/api.js';
import { sesion } from '../../compartido/js/comun.js';

const digitos = valor => valor.replace(/[^0-9]/g, '');
const ejemplos = { Visa: '4242424242424242', Mastercard: '5555555555554444' };

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

  function mostrarTarjeta(valor) {
    numero.value = valor.match(/.{1,4}/g)?.join(' ') || '';
    numero.setCustomValidity('');
    const marca = marcaTarjeta(valor);
    for (const logo of logos) logo.hidden = logo.alt !== marca;
    const esEjemplo = Boolean(marca && valor === ejemplos[marca]);
    titular.value = esEjemplo ? 'Cliente BiblioTrack' : '';
    vence.value = esEjemplo ? `12/${String(new Date().getFullYear() + 2).slice(-2)}` : '';
    cvv.value = esEjemplo ? '123' : '';
  }

  function actualizarPago() {
    tarjeta.hidden = tarjeta.disabled = metodo.value !== 'Tarjeta';
    campo('checkout-yape-hint').hidden = metodo.value !== 'Yape';
    if (tarjeta.hidden) mostrarTarjeta('');
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
  function mensaje(texto = '', error = false) {
    ayuda.textContent = texto;
    ayuda.toggleAttribute('data-error', error);
  }

  function limpiarDocumento() {
    clearTimeout(temporal);
    consulta?.abort();
    consulta = undefined;
    nombre.readOnly = true;
    nombre.value = '';
    nombre.placeholder = 'Se completa automáticamente';
    nombre.setCustomValidity('');
    identificador.setCustomValidity('');
    mensaje();
  }

  function actualizarDocumento() {
    limpiarDocumento();
    documento.hidden = documento.disabled = comprobante.value === 'Boleta';
    identificador.value = '';
    identificador.placeholder = `${longitud()} dígitos`;
    campo('receipt-document-label').textContent = tipoDocumento().toUpperCase();
    campo('receipt-name-label').textContent = tipoDocumento() === 'ruc' ? 'Razón social' : 'Nombre completo';
  }

  async function buscar() {
    const valor = identificador.value;
    if (!sesion.id) { mensaje('Inicia sesión para consultar el documento.', true); return; }
    const actual = new AbortController();
    consulta = actual;
    mensaje(`Consultando ${tipoDocumento().toUpperCase()}…`);
    try {
      const datos = await solicitar('documento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoDocumento(), numero: valor }), signal: actual.signal
      }, lector);
      if (actual.signal.aborted) return;
      if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) throw new Error();
      nombre.value = datos.nombre;
      identificador.setCustomValidity('');
      mensaje(tipoDocumento() === 'ruc' ? 'Razón social encontrada.' : 'Nombre encontrado.');
    } catch (error) {
      if (actual.signal.aborted) return;
      identificador.setCustomValidity('');
      if (error.status === 404) {
        mensaje('Documento no encontrado. Revisa el número.', true);
      } else {
        nombre.readOnly = false;
        const etiqueta = tipoDocumento() === 'ruc' ? 'la razón social' : 'el nombre completo';
        nombre.placeholder = `Ingresa ${etiqueta}`;
        mensaje(`La consulta está temporalmente fuera de servicio. Puedes escribir ${etiqueta}.`, true);
      }
    } finally {
      if (consulta === actual) consulta = undefined;
    }
  }

  identificador.addEventListener('input', () => {
    limpiarDocumento();
    identificador.value = digitos(identificador.value).slice(0, longitud());
    if (identificador.value.length === longitud()) temporal = setTimeout(buscar, 280);
  });
  nombre.addEventListener('input', () => nombre.setCustomValidity(''));
  metodo.addEventListener('change', actualizarPago);
  comprobante.addEventListener('change', actualizarDocumento);
  actualizarPago();
  actualizarDocumento();

  return {
    validar() {
      if (!tarjeta.hidden) {
        const valor = digitos(numero.value);
        numero.setCustomValidity(Object.values(ejemplos).includes(valor) ? '' : 'Ingresa un número de tarjeta de ejemplo válido.');
      }
      if (!documento.hidden) {
        if (identificador.value.length !== longitud()) {
          identificador.setCustomValidity(`Ingresa los ${longitud()} dígitos del ${tipoDocumento().toUpperCase()}.`);
        } else if (nombre.readOnly && !nombre.value) {
          identificador.setCustomValidity(ayuda.hasAttribute('data-error')
            ? ayuda.textContent : 'Espera a que termine la consulta.');
        } else if (!nombre.readOnly) {
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
      actualizarDocumento();
    },
    salir() { mostrarTarjeta(''); limpiarDocumento(); }
  };
}
