# Diseño de BiblioTrack

## Referencias y alcance

La estructura de catálogo y administración procede del video `threadsdownloader.com_d5e4e7.mp4`, de 10,73 segundos. Se mantienen sus superficies redondeadas, controles tipo píldora, entradas escalonadas y transición circular de tema, con navegación exclusivamente arriba.

La revisión de acceso del 25 de octubre usa la captura aportada a las 14:33 como referencia dominante: composición dividida a toda altura, bloque turquesa y gran tipografía. Se rediseñan únicamente inicio, login y registro; la paleta turquesa sustituye al verde en el resto sin alterar sus distribuciones.

| Decisión | Fuente | Aplicación |
| --- | --- | --- |
| Turquesa de referencia y tonos de contraste | Captura del usuario + Refero Color | `#159598` en acceso; acciones `#087176` en claro y `#79d6d8` en oscuro |
| Barra horizontal con selección tipo píldora | Video + requisito del usuario | Misma navegación en catálogo, inventario y reporte |
| Expansión circular desde el botón de tema | Video, 9–10 s | View Transitions con alternativa inmediata si no está disponible |
| Aparición escalonada, trazado SVG y contadores | Video + referencias Motion/Refero | Jerarquía de tarjetas y cambios de datos, sin bucles decorativos |
| Fotografía de biblioteca existente | Activo original del proyecto | Panel visual de acceso y registro |
| Continuidad de sesión y preferencias | Relationship Design | Saludo personal, tema persistente, carrito existente y mensajes claros |
| Reporte con datos verificables | API y autorización existentes | Solo ADMIN; períodos, ingresos, transacciones, ticket y métodos de pago |

Los colores estadísticos representan series reales; no se introducen datos de demostración en la aplicación. Se respeta `prefers-reduced-motion`. La estructura Java, los contratos de API y el esquema de base de datos se conservan.

## Animaciones y dependencias

Motion 14.6.0 se sirve localmente desde `frontend/compartido/vendor`, con su licencia MIT. No requiere npm ni un proceso de compilación para ejecutar el sitio. CSS atiende hover/foco; Motion atiende entradas, contadores y trazados. El navegador controla la expansión del tema. Fuentes: [Motion animate](https://motion.dev/docs/animate), [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition), referencias locales de Refero sobre formularios y movimiento.

## Acceso: decisiones de la revisión

| Decisión | Referencia y aplicación |
| --- | --- |
| División vertical sin tarjetas exteriores | Captura del usuario; continuidad del bloque de marca y del panel fotográfico |
| Outfit para titulares de acceso | UI UX Pro Max, búsqueda de librería editorial; Manrope permanece en el producto |
| Fotografía real existente | Conserva el papel visual de la biblioteca y evita el recurso roto de la captura |
| Revelado por líneas y apertura del panel | Refero Motion, jerarquía y continuidad; `animate` y `stagger` de Motion |
| Profundidad al mover el puntero | Desplazamiento de hasta 7 px en la fotografía; sin bucles y desactivado con movimiento reducido |
| Confirmación de acceso y registro | Se muestra después de una respuesta satisfactoria de la API; redirección existente por rol |

El resultado genérico de UI UX Pro Max sugería añadir secciones de marketing. Se descartó esa estructura por el alcance explícito del usuario. No hay Refero MCP conectado: se utilizaron la captura y las referencias locales de tipografía, color y movimiento. Motion MCP proporcionó la documentación de `stagger` y el uso global compatible con la biblioteca local instalada.
