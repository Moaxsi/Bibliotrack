# Pruebas de seguridad de BiblioTrack

Ejecución del 12 de noviembre de 2026. El informe Word reúne SAST, SCA, matriz de roles, prueba HTTP 403 y DAST con capturas.

- Semgrep 1.185.0: 176 reglas sobre 64 archivos, cero hallazgos y errores.
- OSV: inventario Maven de 86 componentes; 11 avisos iniciales en tres componentes, cero tras actualizar Spring Boot de 4.1.1 a 4.1.2. Dependency-Check 13.0.0 no pudo actualizar NVD por la validación de clave; el registro se conserva.
- Control de acceso: 11 comprobaciones directas aprobadas antes, después en 8082 y al activar la versión final en 8081.
- Ejecución inicial: 20 pruebas Maven/JUnit aprobadas. La ampliación descrita debajo eleva el total a 26.
- ZAP 2.17.0: spider, análisis pasivo y prueba activa acotada al GET público del catálogo. Se conservan reportes HTML y JSON de ambos estados.

El backend actualizado quedó funcionando en el puerto habitual 8081. El frontend no cambió; la comparación de huellas se conserva en evidencias/archivos-modificados.json. Las correcciones propias se limitan al parent Maven, cabecera CSP, retiro de CORS global y una prueba de regresión.

Quedan alertas medias sobre permisos CSP, fuentes sin SRI y transporte HTTP local. El informe detalla su mitigación y los límites del análisis. No equivale a una aprobación para producción.

Las capturas de exportaciones muestran datos de los reportes conservados, sin imitar la interfaz de las herramientas. Los JWT de las pruebas HTTP se ocultaron.

Motion 14.6.0 se consultó por separado en OSV, sin avisos. El SHA-256 del archivo local coincide con dist/motion.js del paquete oficial de npm. Evidencia: evidencias/sca-motion.json.

## Ampliación para la demostración en clase

Se ejecutaron por separado 8 pruebas unitarias de autenticación, criptografía y validación, sin iniciar Spring Boot ni PostgreSQL. Luego se ejecutó el conjunto de 26 pruebas: 8 unitarias y 18 de integración HTTP con esquema PostgreSQL temporal. Ambas ejecuciones terminaron con cero fallos, errores u omisiones.

Se añadieron 9 comprobaciones HTTP de seguridad aprobadas y 15 capturas nuevas de exportaciones del código real, reportes Surefire, registros Maven y respuestas HTTP. Los anexos C, D y E del Word incluyen las evidencias, los comandos, una guía para exponer y la revisión de la documentación.

Evidencias reproducibles: `evidencias/ampliacion_unitarias/`. El único archivo de código agregado en esta ampliación es `src/test/java/com/bibliotrack/ica/validacion/ReglasTest.java`; el código de producción y el frontend permanecen iguales.
