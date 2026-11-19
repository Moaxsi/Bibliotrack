export function fechaValida(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function calcularReporte(ventas, periodo = '30', ahora = new Date()) {
  const fin = new Date(ahora); fin.setHours(23, 59, 59, 999);
  const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
  const fechadas = ventas.map(venta => ({ ...venta, fechaDate: fechaValida(venta.fecha) }));
  if (periodo === 'all') {
    const fechas = fechadas.filter(v => v.fechaDate && v.fechaDate <= fin).map(v => v.fechaDate.getTime());
    if (fechas.length) inicio.setTime(Math.min(inicio.getTime(), ...fechas));
    inicio.setHours(0, 0, 0, 0);
  } else {
    const dias = ['7', '30', '90'].includes(String(periodo)) ? Number(periodo) : 30;
    inicio.setDate(inicio.getDate() - dias + 1);
  }
  const filtradas = fechadas.filter(v => v.fechaDate && v.fechaDate >= inicio && v.fechaDate <= fin)
    .sort((a, b) => b.fechaDate - a.fechaDate || Number(b.idVenta) - Number(a.idVenta));
  const completadas = filtradas.filter(v => String(v.estado).toLowerCase() === 'completada');
  const totalCentimos = completadas.reduce((sum, v) => sum + Math.round((Number(v.total) || 0) * 100), 0);
  const metodos = new Map();
  completadas.forEach(v => { const nombre = String(v.metodoPago || 'Sin especificar'); metodos.set(nombre, (metodos.get(nombre) || 0) + 1); });
  const pagos = [...metodos].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
  const mensual = (fin - inicio) / 86400000 > 93;
  const clave = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}${mensual ? '' : `-${String(f.getDate()).padStart(2, '0')}`}`;
  const buckets = new Map(); const cursor = new Date(inicio);
  if (mensual) cursor.setDate(1);
  while (cursor <= fin) {
    buckets.set(clave(cursor), { fecha: new Date(cursor), totalCentimos: 0 });
    if (mensual) cursor.setMonth(cursor.getMonth() + 1); else cursor.setDate(cursor.getDate() + 1);
  }
  completadas.forEach(v => { const b = buckets.get(clave(v.fechaDate)); if (b) b.totalCentimos += Math.round((Number(v.total) || 0) * 100); });
  return { inicio, fin, filtradas, completadas, total: totalCentimos / 100,
    promedio: completadas.length ? totalCentimos / 100 / completadas.length : 0, pagos, mensual,
    sinFecha: fechadas.filter(v => !v.fechaDate).length,
    serie: [...buckets.values()].map(b => ({ fecha: b.fecha, total: b.totalCentimos / 100 })) };
}
export function csvVentas(ventas) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const filas = [['Código', 'Fecha', 'Cliente', 'Comprobante', 'Método de pago', 'Total PEN', 'Estado'],
    ...ventas.map(v => [`V-${v.idVenta}`, v.fecha, v.clienteNombre || 'Cliente general', v.tipoComprobante, v.metodoPago, Number(v.total || 0).toFixed(2), v.estado])];
  return '\uFEFF' + filas.map(f => f.map(cell).join(',')).join('\r\n');
}
