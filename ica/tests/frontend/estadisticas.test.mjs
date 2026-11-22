import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../src/main/resources/static/frontend/admin/js/estadisticas.js', import.meta.url), 'utf8');
const { calcularReporte, csvVentas } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const ahora = new Date(2026, 9, 25, 12);
const v = (id, fecha, total, estado = 'Completada', metodoPago = 'Yape') => ({ idVenta: id, fecha, total, estado, metodoPago });
test('El período de 7 días incluye el día inicial completo y descarta fechas futuras e inválidas', () => {
  const r = calcularReporte([v(1,'2026-10-19T00:00:00',10),v(2,'2026-10-18T23:59:59',20),v(3,'2026-10-25T23:59:59',30),v(4,'2026-10-26T00:00:00',40),v(5,null,100)],'7',ahora);
  assert.equal(r.total,40); assert.equal(r.filtradas.length,2); assert.equal(r.sinFecha,1); assert.equal(r.serie.length,7);
});
test('Solo ventas completadas participan en métricas, sin perder otros estados en el historial', () => {
  const r = calcularReporte([v(1,'2026-10-25T08:00:00',10.10),v(2,'2026-10-25T09:00:00',20.20),v(3,'2026-10-25T10:00:00',100,'Anulada')],'30',ahora);
  assert.equal(r.total,30.3); assert.equal(r.promedio,15.15); assert.equal(r.completadas.length,2); assert.equal(r.filtradas.length,3);
  assert.equal(r.serie.at(-1).total,30.3); assert.deepEqual(r.pagos,[{nombre:'Yape',cantidad:2}]);
});
test('Los pedidos Yape solo aparecen en ingresos después de confirmarse', () => {
  const fecha = '2026-10-25T08:00:00';
  const r = calcularReporte([v(1, fecha, 10, 'Pendiente'), v(2, fecha, 20, 'Confirmada'),
    v(3, fecha, 30, 'Rechazada'), v(4, fecha, 40, 'Vencida')], '30', ahora);
  assert.equal(r.filtradas.length, 4);
  assert.equal(r.total, 20);
  assert.equal(r.completadas.length, 1);
});
test('No inventa ventas en períodos vacíos', () => {
  const r = calcularReporte([],'30',ahora); assert.equal(r.total,0); assert.equal(r.promedio,0); assert.equal(r.serie.length,30); assert.ok(r.serie.every(d=>d.total===0)); assert.deepEqual(r.pagos,[]);
});
test('Agrupa por mes historiales extensos sin perder ingresos', () => {
  const r=calcularReporte([v(1,'2025-12-31T09:00:00',100),v(2,'2026-01-01T09:00:00',200),v(3,'2026-10-25T09:00:00',300)],'all',ahora);
  assert.equal(r.mensual,true);assert.equal(r.serie.length,11);assert.equal(r.serie.reduce((s,d)=>s+d.total,0),600);assert.equal(r.serie[0].fecha.getMonth(),11);
});
test('Ordena ventas y contabiliza métodos según compras, no ingresos', () => {
  const r=calcularReporte([v(1,'2026-10-24T12:00:00',1000,'Completada','Tarjeta'),v(2,'2026-10-25T12:00:00',10),v(3,'2026-10-25T13:00:00',20)],'7',ahora);
  assert.equal(r.pagos[0].nombre,'Yape');assert.deepEqual(r.filtradas.map(v=>v.idVenta),[3,2,1]);
});
test('CSV conserva acentos, comas y comillas y neutraliza fórmulas de hoja de cálculo', () => {
  const csv=csvVentas([{...v(1,'2026-10-25',10),clienteNombre:'=SUM(1,2)',tipoComprobante:'Boleta "especial"'}]);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"Boleta ""especial"""'));
});
