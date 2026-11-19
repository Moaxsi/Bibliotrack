# Verificación del rediseño

Fecha: 25 de octubre de 2026. Proyecto: `/Users/flavio/Documents/VScode/BiblioTrack/ica`.

## Verificación inicial

- 41 comprobaciones de navegador aprobadas en Chromium: acceso, registro, catálogo, búsqueda, carrito, inventario, formularios, modales, reporte, filtros, paginación, exportación, estados vacíos y errores.
- 6 pruebas de estadísticas aprobadas: límites de fecha, estado de venta, importes en céntimos, agrupación mensual, métodos de pago y CSV seguro.
- 2 pruebas existentes de `AuthenticationComponentsTest` aprobadas.
- Sin errores de JavaScript durante los recorridos. Sintaxis de los módulos y `git diff --check` correctos.
- Vistas verificadas a 1440 y 390 px; acceso, registro, catálogo y contacto también a 320 px. Las tablas tienen desplazamiento horizontal local con acceso por teclado. Los gráficos ajustan sus etiquetas al ancho disponible.
- Transición circular del tema observada durante la animación mediante captura y comprobación del `clip-path`. Tema persistente, alternativa sin View Transitions y respeto de movimiento reducido.
- Modales con foco contenido, cierre con Escape y retorno del foco al control de apertura.

## Datos y permisos

El catálogo se comprobó con los siete libros existentes mediante lecturas reales. Se confirmó que una petición sin autenticación a ventas es rechazada por el backend. Los invitados y clientes no ven Reporte; el acceso directo de un invitado redirige al login.

Registro, inicio de sesión de prueba, guardado de libros, detalle de ventas y checkout se comprobaron en contextos aislados del navegador con todas las peticiones API interceptadas. Las ventas de las capturas del reporte son datos de prueba. No se añadieron datos de demostración al producto ni se ejecutaron escrituras de prueba en la base de datos.

Se compararon SHA-256 de 22 archivos originales: Java, `pom.xml` y configuración del servidor. Todos permanecen idénticos. No se modificaron esquema, controladores, entidades, repositorios ni contratos de API.

## Accesibilidad

Axe 4.12.1 no detectó infracciones automáticas en acceso ni catálogo. Las comprobaciones automáticas de contraste sobre fotografía y ciertas capas superpuestas requieren revisión visual; no se presenta el resultado como certificación completa. Se revisaron visualmente tema claro, oscuro, foco, formularios y tamaños móviles.

## Repetir las pruebas locales

Desde la carpeta del proyecto:

```sh
node --test tests/frontend/estadisticas.test.mjs
./mvnw -q -Dtest=AuthenticationComponentsTest test
```

La aplicación existente sirve el rediseño en `http://localhost:8081/`. Para copiar cambios estáticos al directorio de ejecución de Maven se utilizó `./mvnw resources:resources -q`.

## Mapa de arquitectura

`graphify-out/graph.html` y `GRAPH_REPORT.md` documentan la arquitectura estudiada antes del rediseño: 344 nodos, 641 relaciones y 14 comunidades. Se conserva la marca de actualización pendiente del frontend para no tratar ese análisis como una representación de su versión final. El diagnóstico registra enlaces a símbolos no definidos y relaciones colapsadas; véase `GRAPH_HEALTH.md`.

## Revisión de acceso y paleta turquesa, 25 de octubre

Se verificaron inicio, login y registro a 1440 px, 768 px, 375 px, 320 px y en horizontal a 844 × 390 px, sin desbordes ni títulos recortados. Las fotografías cargan correctamente. Se revisaron capturas de ambas variantes de tema.

Los recorridos de navegador comprobaron los estados de carga, contraseña visible, credenciales incorrectas, fallo de conexión, reintento, registro duplicado, confirmaciones animadas y redirección de ADMIN y CLIENTE. Todas las operaciones de autenticación de prueba utilizaron API simulada. Se confirmó la restauración al usar Atrás, el cambio de tema con movimiento reducido y el contenido visible cuando Motion no carga.

Axe no detectó infracciones automáticas en inicio claro, login claro/oscuro y registro claro/oscuro. Los textos superpuestos a fotografía conservan comprobaciones de contraste que requieren inspección visual.

La comparación de archivos confirma que esta revisión modifica únicamente las tres páginas de acceso, su JavaScript y los colores compartidos, añadiendo CSS y movimiento específicos de acceso. Al normalizar los valores de color, el CSS compartido es idéntico al anterior: medidas, distribución y componentes del catálogo y administración permanecen iguales. El código Java y los archivos de configuración permanecen intactos; no se modificó la base de datos.
