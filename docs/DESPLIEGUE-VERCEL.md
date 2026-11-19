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
