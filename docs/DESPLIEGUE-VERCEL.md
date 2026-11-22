# BiblioTrack en Vercel y Supabase

La publicación usa Vercel Hobby para HTML, CSS, JavaScript y una API Node.js. El proyecto Java original de `ica/` se conserva para uso local. Ambos usan el mismo esquema PostgreSQL. No se necesita React ni alojar un proceso Java en Vercel.

`npm ci` instala las dependencias fijadas en `package-lock.json`. `npm run build` copia exclusivamente los recursos públicos de `ica/src/main/resources/static/` a `dist/`. Vercel construye `api/index.mjs` por separado. Los archivos Java, SQL y documentación no forman parte de los recursos públicos.

Configurar en Vercel, sin publicar sus valores en Git:

- `PGHOST`: host del pooler de Supabase.
- `PGPORT`: puerto del pooler.
- `PGDATABASE`: base PostgreSQL.
- `PGUSER`: usuario del proyecto Supabase.
- `PGPASSWORD`: contraseña de PostgreSQL.
- `BIBLIOTRACK_JWT_SECRET`: secreto aleatorio de al menos 32 bytes.

La conexión verifica TLS con el certificado público de Supabase incluido en `server/supabase-ca.pem`. Este certificado es público y no contiene claves privadas. Fuente de descarga: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.

Ejecutar una sola vez `sql/cloud-portadas.sql` en la base de Supabase. Es una migración aditiva: crea almacenamiento persistente de portadas de hasta 1 MB en PostgreSQL y restringe su acceso directo por la API pública de Supabase. No borra tablas ni datos existentes. Las rutas de carga requieren rol ADMIN y las imágenes se validan y procesan antes de guardarlas.

Las rutas `/api` conservan las respuestas que espera el frontend. BCrypt, JWT de una hora, comprobación de estado y rol en cada solicitud, revocación al cambiar credenciales, validación de importes y transacciones con bloqueo de inventario se implementan en `server/`. Los importes se calculan en céntimos enteros y no se confían precios enviados por el navegador.

`npm test` crea y elimina una base LOCAL temporal `bibliotrack_cloud_test_*` mediante PostgreSQL en localhost, usuario postgres. Nunca usa ni modifica la base de Supabase. Comprueba acceso, registro, validación, historial, inventario, compras concurrentes y portadas.

El despliegue se mantiene en planes gratuitos. Los límites de Vercel Hobby y Supabase Free siguen aplicando; no se habilitan planes de pago, tarjeta, Observability Plus ni servicios adicionales. Los métodos de pago de las ventas solo registran la elección del usuario; esta aplicación no cobra tarjetas ni mueve dinero.

## Carrito y revisión de pagos Yape

1. Ejecuta `sql/cloud-checkout.sql` en el editor SQL de Supabase antes de desplegar. Añade dos columnas de comprobante y se puede ejecutar más de una vez. Para usar Spring con una base existente, aplica el mismo SQL a esa base.
2. En **Settings → Environment Variables** del proyecto BiblioTrack en Vercel, añade `DECOLECTA_TOKEN` como secreto en **Production** y también en **Preview** si vas a probar allí. Usa un token activo de Decolecta. Si vienes de Render, toma el valor de la variable del servicio que ya consulta DNI y RUC. Usa el mismo nombre de variable al iniciar Spring localmente. [Variables de entorno en Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)
3. Haz un nuevo despliegue desde la raíz que contiene `vercel.json` y el frontend actualizado en `ica/src/main/resources/static/`. Si Vercel construye desde Git, publica el contenido de `ica/` con una referencia de submódulo accesible o como parte del repositorio de despliegue. Inicia sesión en el despliegue, abre el carrito y escribe un DNI de 8 dígitos para boleta de venta o un RUC de 11 dígitos para factura. La función `/api/documento` consulta Decolecta desde el servidor. Si el servicio está temporalmente fuera de línea, el formulario permite completar el nombre o la razón social manualmente.
4. El QR de Yape es la imagen entregada para el sitio. El equipo debe comprobar en Yape que el abono coincida con el importe antes de pulsar **Confirmar pago** en el detalle de Reportes. La opción Tarjeta usa ejemplos de Visa y Mastercard y registra el pedido sin cargo.

Una compra web por Yape reserva las unidades durante la ventana de pago de 24 horas. Si se confirma, descuenta el inventario. Si se rechaza o vence, las unidades vuelven a estar disponibles para comprar. Solo los pedidos completados y confirmados entran en las métricas.

Los SVG de Visa y Mastercard se distribuyen sin modificaciones desde [Payment Logos de Datatrans](https://github.com/datatrans/payment-logos/tree/b4175c79813792f1e2ab16c10cfd9f15d5af0e77), bajo [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
