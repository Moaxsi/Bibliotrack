import './registrar-venta.js';
import { alMontarPagina } from '../../compartido/js/pagina.js';
import { API_URL, requiereAdmin, fetchConToken, limpiarSesion } from '../../compartido/js/comun.js';
import { animarEntrada, animarNumero, detenerNumero, movimientoReducido, moneda, escapar, abrirModal, cerrarModal } from '../../compartido/js/interfaz.js';
import { calcularReporte, csvVentas } from './estadisticas.js';

alMontarPagina('#sales-table-body', (vista) => {
  if (!requiereAdmin()) return;
  let ventas = [], reporte = null, periodo = '30', pagina = 0, solicitud = 0, detalleSolicitud = 0;
  const perPage = 8;
  const tabla = document.getElementById('sales-table-body');
  const feedback = document.getElementById('report-feedback');
  const refresh = document.getElementById('report-refresh');
  const exportButton = document.getElementById('report-export');
  const fecha = date => date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  const entero = value => Math.round(value).toLocaleString('es-PE');
  const color = index => `var(--chart-${(index % 4) + 1})`;

  async function leer(url) {
    const response = await fetchConToken(url, {}, vista.fetch);
    vista.signal.throwIfAborted();
    if (response.status === 401) {
      limpiarSesion(); location.replace('/frontend/auth/login.html');
      throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
    }
    if (response.status === 403) throw new Error('No tienes permiso para consultar las ventas.');
    if (!response.ok) throw new Error('No pudimos cargar las ventas. Intenta nuevamente.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('La respuesta de ventas no es válida.');
    return data;
  }
  async function cargar() {
    const request = ++solicitud;
    refresh.disabled = true; exportButton.disabled = true;
    refresh.setAttribute('aria-busy', 'true'); feedback.hidden = true;
    try {
      const data = await leer(`${API_URL}/ventas`);
      if (vista.signal.aborted || request !== solicitud) return;
      ventas = data; actualizar();
    } catch (error) {
      if (vista.signal.aborted || request !== solicitud) return;
      reporte = null; feedback.hidden = false; feedback.textContent = error.message;
      ['kpi-ingresos-totales', 'kpi-total-ventas', 'kpi-ticket-promedio', 'kpi-metodo-top'].forEach(id => {
        const element = document.getElementById(id); detenerNumero(element); element.textContent = 'No disponible';
      });
      tabla.innerHTML = '<tr><td colspan="8" class="empty-table-cell">No se pudieron cargar los datos. Usa el botón Actualizar para reintentar.</td></tr>';
      document.getElementById('revenue-chart').innerHTML = '<div class="chart-placeholder">No hay datos disponibles para mostrar.</div>';
      document.getElementById('payment-chart').replaceChildren(); document.getElementById('payment-legend').replaceChildren();
      document.getElementById('report-table-count').textContent = 'Historial no disponible'; document.getElementById('report-page-info').textContent = '';
      document.getElementById('report-prev').disabled = true; document.getElementById('report-next').disabled = true;
    } finally {
      if (!vista.signal.aborted && request === solicitud) { refresh.disabled = false; refresh.setAttribute('aria-busy', 'false'); document.getElementById('revenue-chart').setAttribute('aria-busy', 'false'); }
    }
  }
  function actualizar() {
    reporte = calcularReporte(ventas, periodo); pagina = 0;
    document.getElementById('report-date-range').textContent = `${fecha(reporte.inicio)} – ${fecha(reporte.fin)}`;
    animarNumero(document.getElementById('kpi-ingresos-totales'), reporte.total, moneda);
    animarNumero(document.getElementById('kpi-total-ventas'), reporte.completadas.length, entero);
    animarNumero(document.getElementById('kpi-ticket-promedio'), reporte.promedio, moneda);
    document.getElementById('kpi-metodo-top').textContent = reporte.pagos[0]?.nombre || 'Sin ventas';
    feedback.hidden = true;
    if (reporte.sinFecha) { feedback.textContent = `${reporte.sinFecha} venta(s) sin una fecha válida quedaron fuera del reporte.`; feedback.hidden = false; }
    exportButton.disabled = !reporte.filtradas.length;
    dibujarIngresos(); dibujarPagos(); renderTabla();
  }
  function dibujarIngresos(animate = true) {
    const wrapper = document.getElementById('revenue-chart'), values = reporte.serie;
    document.getElementById('revenue-subtitle').textContent = `Ingresos por ${reporte.mensual ? 'mes' : 'día'}, en soles`;
    const width = Math.max(320, Math.min(740, wrapper.clientWidth));
    const height = 270, left = 46, top = 20, bottom = 233, right = width - 20;
    const max = Math.max(1, ...values.map(d => d.total));
    const ceiling = max <= 10 ? Math.ceil(max) : Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max));
    const points = values.map((d, i) => ({ x: values.length === 1 ? (left + right) / 2 : left + i * (right - left) / (values.length - 1), y: bottom - d.total / ceiling * (bottom - top), ...d }));
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const y = top + (bottom - top) * i / 4, amount = ceiling * (1 - i / 4);
      return `<line class="chart-grid" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text class="chart-label" x="${left - 10}" y="${y + 3}" text-anchor="end">${new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)}</text>`;
    }).join('');
    const step = Math.max(1, Math.ceil((values.length - 1) / (width < 500 ? 3 : 6)));
    const labels = points.filter((_, i) => i === points.length - 1 || (i % step === 0 && points.length - 1 - i >= step / 2)).map(p => `<text class="chart-label" x="${p.x}" y="258" text-anchor="middle">${escapar(p.fecha.toLocaleDateString('es-PE', reporte.mensual ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' }))}</text>`).join('');
    const hits = points.map((p, i) => `<g><circle class="chart-point-hit" cx="${p.x}" cy="${p.y}" r="12" tabindex="0" data-point="${i}" role="img" aria-label="${escapar(fecha(p.fecha))}: ${escapar(moneda(p.total))}"/><circle class="chart-point" cx="${p.x}" cy="${p.y}" r="${points.length === 1 ? 4 : 2}" pointer-events="none"/></g>`).join('');
    wrapper.innerHTML = `<svg class="revenue-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="revenue-title revenue-description"><title id="revenue-title">Ingresos ${reporte.mensual ? 'mensuales' : 'diarios'}</title><desc id="revenue-description">${escapar(moneda(reporte.total))} en ${reporte.completadas.length} ventas completadas. Consulta cada punto con el teclado.</desc><defs><linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--chart-1)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--chart-1)" stop-opacity=".01"/></linearGradient></defs>${ticks}<path d="${path} L${points.at(-1).x},${bottom} L${points[0].x},${bottom} Z" fill="url(#revenue-fill)"/><path class="chart-line" d="${path}"/>${labels}${hits}</svg><div class="chart-tooltip" hidden></div>`;
    document.getElementById('revenue-caption').textContent = reporte.completadas.length ? `${reporte.mensual ? 'Agrupado por mes' : 'Cada punto representa un día'}. Pasa el cursor o usa Tab para consultar los importes.` : 'Aún no hay ventas completadas en este período. Prueba con «Todo» para ver el historial.';
    if (animate && !movimientoReducido() && window.Motion && reporte.total > 0) window.Motion.animate(wrapper.querySelector('.chart-line'), { pathLength: [0, 1] }, { duration: .8, ease: 'easeInOut' });
    const tooltip = wrapper.querySelector('.chart-tooltip');
    wrapper.querySelectorAll('[data-point]').forEach(hit => {
      const show = () => {
        const point = points[Number(hit.dataset.point)]; tooltip.textContent = `${fecha(point.fecha)} · ${moneda(point.total)}`; tooltip.hidden = false;
        const scale = wrapper.clientWidth / width;
        const x = Math.min(Math.max(0, point.x * scale - tooltip.offsetWidth / 2), wrapper.clientWidth - tooltip.offsetWidth);
        tooltip.style.transform = `translate(${x}px, ${Math.max(0, point.y * scale - 48)}px)`;
      };
      hit.addEventListener('pointerenter', show); hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', () => { tooltip.hidden = true; }); hit.addEventListener('blur', () => { tooltip.hidden = true; });
    });
  }
  function dibujarPagos() {
    const total = reporte.completadas.length; let offset = 0;
    const segments = reporte.pagos.map((p, index) => {
      const length = p.cantidad / total * 100;
      const s = `<circle cx="90" cy="90" r="70" fill="none" stroke="${color(index)}" stroke-width="18" pathLength="100" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}"/>`;
      offset += length; return s;
    }).join('');
    document.getElementById('payment-chart').innerHTML = `<div class="donut-wrap"><svg viewBox="0 0 180 180" role="img" aria-label="Distribución de ${total} compras por método de pago"><circle cx="90" cy="90" r="70" fill="none" stroke="var(--border)" stroke-width="18"/>${segments}</svg><div class="donut-center"><strong>${total}</strong><span>compras</span></div></div>`;
    document.getElementById('payment-legend').innerHTML = reporte.pagos.length ? reporte.pagos.map((p, i) => `<div class="payment-legend-row"><i style="background:${color(i)}"></i><span>${escapar(p.nombre)}</span><strong>${p.cantidad}</strong><small>${Math.round(p.cantidad / total * 100)} %</small></div>`).join('') : '<p class="chart-caption">Los métodos aparecerán con tu primera venta.</p>';
    animarEntrada(document.querySelectorAll('.donut-wrap, .payment-legend-row'));
  }
  function renderTabla() {
    if (!reporte) return;
    const query = document.getElementById('report-search').value.toLocaleLowerCase('es').trim();
    const filtered = reporte.filtradas.filter(v => `${v.idVenta} V-${String(v.idVenta).padStart(4, '0')} ${v.clienteNombre || ''} ${v.metodoPago || ''}`.toLocaleLowerCase('es').includes(query));
    const pages = Math.max(1, Math.ceil(filtered.length / perPage)); pagina = Math.min(pagina, pages - 1);
    tabla.dataset.page = String(pagina);
    const shown = filtered.slice(pagina * perPage, (pagina + 1) * perPage);
    document.getElementById('report-table-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'venta' : 'ventas'}${query ? ' encontradas' : ' en el período'}`;
    tabla.replaceChildren();
    if (!shown.length) tabla.innerHTML = `<tr><td colspan="8" class="empty-table-cell">${query ? 'No hay ventas que coincidan con tu búsqueda.' : 'Todavía no hay ventas en este período.'}</td></tr>`;
    shown.forEach(v => {
      const codigo = `#V-${String(v.idVenta).padStart(4, '0')}`, tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${escapar(codigo)}</strong></td><td>${escapar(fecha(v.fechaDate))}</td><td>${escapar(v.clienteNombre || 'Cliente general')}</td><td>${escapar(v.tipoComprobante || 'Boleta')}</td><td><span class="payment-tag">${escapar(v.metodoPago || 'Sin especificar')}</span></td><td><strong>${escapar(moneda(v.total))}</strong></td><td><span class="status-tag ${String(v.estado).toLowerCase() === 'completada' ? 'activo' : 'inactivo'}">${escapar(v.estado || 'Sin estado')}</span></td><td><button type="button" class="btn-action-edit" aria-label="Ver detalle de ${escapar(codigo)}">Ver detalle</button></td>`;
      tr.querySelector('button').addEventListener('click', () => verDetalle(v, codigo)); tabla.appendChild(tr);
    });
    document.getElementById('report-page-info').textContent = filtered.length ? `${pagina * perPage + 1}–${Math.min((pagina + 1) * perPage, filtered.length)} de ${filtered.length}` : 'Sin resultados';
    document.getElementById('report-prev').disabled = pagina === 0; document.getElementById('report-next').disabled = pagina === pages - 1;
    animarEntrada(shown.length ? tabla.children : []);
  }
  async function verDetalle(venta, codigo) {
    const request = ++detalleSolicitud, container = document.getElementById('sale-detail-items-wrapper');
    document.getElementById('modal-venta-title').textContent = `Detalle de ${codigo}`; document.getElementById('modal-venta-total-val').textContent = moneda(venta.total);
    container.innerHTML = '<p class="empty-table-cell">Cargando los libros de esta compra…</p>'; abrirModal('modal-detalle-venta');
    try {
      const items = await leer(`${API_URL}/ventas/${encodeURIComponent(venta.idVenta)}/detalle`);
      if (vista.signal.aborted || request !== detalleSolicitud) return;
      container.innerHTML = items.length ? items.map(it => `<div class="cart-row"><div><div class="cart-item-title">${escapar(it.tituloLibro || 'Libro')}</div><div class="cart-item-price">ISBN ${escapar(it.isbn || 'Sin registro')} · ${escapar(moneda(it.precioUnitario))} por unidad</div></div><div><span>${Number(it.cantidad) || 0} unidades · </span><strong class="detail-amount">${escapar(moneda(it.subtotal))}</strong></div></div>`).join('') : '<p class="empty-table-cell">No hay detalle disponible para esta venta.</p>';
      animarEntrada(container.children);
    } catch (error) { if (!vista.signal.aborted && request === detalleSolicitud) container.innerHTML = `<p class="empty-table-cell">${escapar(error.message)}</p>`; }
  }
  window.cerrarModalDetalleVenta = () => { ++detalleSolicitud; cerrarModal('modal-detalle-venta'); };
  document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => {
    periodo = button.dataset.period;
    document.querySelectorAll('[data-period]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    if (reporte) actualizar();
  }));
  document.getElementById('report-search').addEventListener('input', () => { pagina = 0; renderTabla(); });
  document.getElementById('report-prev').addEventListener('click', () => { pagina--; renderTabla(); });
  document.getElementById('report-next').addEventListener('click', () => { pagina++; renderTabla(); });
  refresh.addEventListener('click', cargar);
  let chartWidth = 0;
  const observer = new ResizeObserver(entries => {
    if (vista.signal.aborted) return;
    const width = Math.round(entries[0].contentRect.width);
    if (width === chartWidth) return;
    chartWidth = width;
    if (reporte) dibujarIngresos(false);
  });
  observer.observe(document.getElementById('revenue-chart'));
  vista.alSalir(() => observer.disconnect());
  exportButton.addEventListener('click', () => {
    if (!reporte?.filtradas.length) return;
    const url = URL.createObjectURL(new Blob([csvVentas(reporte.filtradas)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `bibliotrack-ventas-${periodo}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return cargar();
});
