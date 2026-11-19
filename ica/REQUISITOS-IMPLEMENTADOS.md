# Requisitos del avance 2

Implementación sobre la versión de `/Users/flavio/Documents/VScode/BiblioTrack/ica`.
Se conservaron las dependencias del proyecto y el diseño de las pantallas existentes.

## Funcionalidades

| ID | Implementación |
| --- | --- |
| RF-01 | Registro de libros con ISBN, título, autor, precio, stock y categoría. |
| RF-02 | Edición de libros con validaciones en el servidor y confirmación al guardar. |
| RF-03 | Consulta de existencias y descuento automático dentro de la transacción de venta. |
| RF-04 | Registro administrativo desde Reporte, seleccionando cliente, libros y cantidades. |
| RF-05 | Usuarios: listado, búsqueda, filtros, creación, edición, asignación de rol y estado. |
| RF-06 | Acceso por correo y contraseña con BCrypt y JWT. |
| RF-07 | Búsqueda por título, autor o ISBN, también combinada con categoría en el servidor. |
| RF-08 | Las tarjetas del catálogo muestran título, autor, ISBN, precio y existencias. |
| RF-09 | Carrito y compra con precios calculados en el servidor. |
| RF-10 | Historial personal con fecha, estado, importe, libros, cantidades y precios de cada compra. |

## Calidad y protección

| ID | Implementación y evidencia |
| --- | --- |
| RNF-01 | Campos obligatorios comprobados en servidor, ISBN normalizado y comprobación de duplicados. |
| RNF-02 | Valores monetarios e inventario validados; categoría inexistente devuelve error; edición transaccional. |
| RNF-03 | Cantidades positivas, acumulación de líneas repetidas y bloqueo de libros en orden de ID. Prueba concurrente con stock insuficiente para ambas compras. |
| RNF-04 | Cabecera, detalles y stock forman una transacción. Prueba de fallo al guardar el detalle confirma la reversión completa. |
| RNF-05 | Administración de usuarios, roles, inventario y reportes protegida por el servidor. Los cambios de estado o rol invalidan permisos anteriores. |
| RNF-06 | BCrypt, contraseña excluida de las respuestas, JWT con vencimiento y revocación al cambiar la contraseña. |
| RNF-07 | Búsqueda en la base de datos, filtrado inmediato en catálogo y estados de carga, error y reintento en las nuevas secciones. El PDF no fija un umbral de tiempo ni una carga de usuarios. |
| RNF-08 | Reutilización de temas y estilos actuales. Inspección visual de las nuevas pantallas a 1280 px, 375 × 812 y 812 × 375; modales con foco y Escape; animaciones actuales con movimiento reducido. |
| RNF-09 | Validación de disponibilidad en servidor; se rechazan cantidades no positivas, decimales, stock insuficiente y libros inactivos. |
| RNF-10 | Historial obtenido desde la identidad autenticada. Un ID de compra de otra cuenta responde 404. |

## Integración visual

Referencia principal: inventario y reporte de ventas existentes. Se conservaron Manrope,
los colores semánticos de ambos temas, las superficies y los botones del sistema.
Se reutilizaron `animarEntrada`, `abrirModal`, `cerrarModal` y la navegación con transiciones.
Las referencias de Refero sobre formularios y foco y la búsqueda de UI UX Pro Max sobre
resúmenes de error guiaron la validación del formulario de usuarios. Relationship Design
se aplicó a la continuidad del historial propio y a la explicación de permisos.

Los estilos nuevos están en `frontend/compartido/css/requisitos.css`. Las pantallas de
acceso y la hoja de estilos original no se rediseñaron. Los enlaces del menú común,
el ISBN del catálogo y el botón de registro de venta son los ajustes de las vistas existentes.

## Base de datos

No se necesitan tablas ni columnas nuevas. Historial utiliza `ventas`, `detalle_ventas`,
`usuarios` y `libros`; administración utiliza `usuarios` y `roles`.

Al iniciar, `LegacyPasswordMigration` convierte las contraseñas heredadas sin BCrypt.
Conserva la clave que el usuario utiliza y no vuelve a convertir los hashes existentes.
Los tokens anteriores a esta actualización requieren un nuevo inicio de sesión.

`sql/migracion_01_implementacionBD.sql` reúne la instalación completa para una base local
de pruebas: siete tablas, restricciones, índices, dos cuentas con BCrypt, cuatro categorías,
34 libros activos y una venta con su detalle y descuento de stock. Reemplaza los dos SQL
anteriores. Cada ejecución borra y recrea las tablas: no es una actualización para conservar
datos existentes. En pgAdmin se crea primero una base vacía `bibliotrack` y después se
ejecuta el archivo completo desde Query Tool conectado a ella.

Se verificó en una base temporal vacía, ejecutándolo dos veces y comprobando restricciones,
login de ambas cuentas, catálogo, Usuarios e Historial con Spring Boot en modo de validación
del esquema. La base temporal se eliminó al terminar. No se ejecutó sobre la base actual.

## Verificación

```sh
./mvnw test
node --test tests/frontend/*.test.mjs
./mvnw -DskipTests package
```

La suite de integración crea un esquema temporal separado en PostgreSQL y lo elimina al
terminar. Cubre aislamiento entre cuentas, permisos, roles, registro y edición de usuarios,
protección de contraseñas, invalidación de tokens, búsqueda, validación de libros, ventas
para clientes, líneas repetidas, concurrencia y reversión de operaciones fallidas.

Las pruebas de navegador utilizaron cuentas y datos ficticios en otro esquema temporal.
Resultado de la suite: 20 pruebas Java y 6 pruebas de reporte en JavaScript, sin fallos.
La búsqueda local del catálogo existente registró una mediana de 7,8 ms y un máximo
de 86,6 ms en 10 solicitudes consecutivas. Esta medición no es una prueba de carga.
Esto valida el comportamiento local revisado; no sustituye pruebas de carga de un despliegue
público ni certifica seguridad o accesibilidad en todos los navegadores y dispositivos.
