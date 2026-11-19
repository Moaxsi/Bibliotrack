# BiblioTrack

Aplicación web de catálogo, carrito, inventario y ventas. El backend usa Java 21, Spring Boot, Spring Web MVC y Spring Data JPA. PostgreSQL almacena los datos. El frontend utiliza HTML, CSS y módulos nativos de JavaScript.

## Preparar la base de datos local

1. En pgAdmin, crea una base vacía llamada `bibliotrack`.
2. Abre **Query Tool** conectado a esa base.
3. Abre `sql/migracion_01_implementacionBD.sql`, copia todo su contenido y ejecútalo completo.
4. Configura en `src/main/resources/application.properties` tu usuario y contraseña de PostgreSQL e inicia la aplicación como se indica abajo.

El archivo reúne estructura, restricciones, índices y datos de prueba. No requiere extensiones de PostgreSQL ni ejecutar otros archivos SQL. Incluye 34 libros activos, cuatro categorías, una venta de ejemplo y estas cuentas con contraseñas ya protegidas con BCrypt:

| Perfil | Correo | Contraseña de prueba |
| --- | --- | --- |
| Administrador | `admin@bibliotrack.com` | `admin123` |
| Cliente | `carlos@gmail.com` | `cliente123` |

**Cada ejecución borra y recrea las siete tablas de BiblioTrack.** Úsalo con la aplicación detenida y solo en una base local de pruebas cuyos datos puedas reemplazar. La venta de ejemplo descuenta una unidad de Clean Code y una de Cien Años de Soledad para mantener el inventario consistente.

Las fuentes de los 30 libros adicionales se conservan en `sql/FUENTES_30_LIBROS.md` y en los comentarios del SQL. Las tres portadas locales están incluidas en el frontend del proyecto.

## Ejecutar

Inicia PostgreSQL y configura una sola vez `src/main/resources/application.properties` con el nombre de la base de datos, usuario y contraseña de PostgreSQL. El archivo local ya contiene los valores de desarrollo para `bibliotrack`, el puerto `8081` y una clave JWT; reemplaza `spring.datasource.username` si tu usuario no es `postgres` y `spring.datasource.password` por tu contraseña real.

`application.properties` está excluido de Git para evitar subir tus credenciales locales. No lo agregues al repositorio ni compartas su contenido.

En VS Code, abre la carpeta `BiblioTrack`, abre `ica/src/main/java/com/bibliotrack/ica/IcaApplication.java` y pulsa **Run** sobre el método `main`. También puedes elegir **BiblioTrack: iniciar sitio y API** en Run and Debug. Esta configuración abre el navegador cuando el servidor termina de iniciar.

El puerto `8081` permite ejecutar BiblioTrack aunque otro proyecto utilice `8080`. Antes de volver a iniciarlo, detén la ejecución anterior de BiblioTrack con el botón Stop de VS Code.

Desde una terminal de macOS o Linux, situado en la carpeta `ica`, ejecuta:

```sh
./mvnw spring-boot:run
```

Desde PowerShell, situado en la misma carpeta, ejecuta:

```powershell
.\mvnw.cmd spring-boot:run
```

La aplicación escucha en `http://localhost:8081/`. Spring Boot sirve el CSS, las imágenes, los módulos JavaScript y la API desde el mismo servidor. Si VS Code muestra una dirección que comienza con `file://`, ciérrala: esa vista no puede cargar las rutas `/frontend/...` ni ejecutar la aplicación completa. Los archivos HTML son recursos del servidor, no páginas para abrir directamente desde el disco.

## Organización

```text
src/main/
├── java/com/bibliotrack/ica/
│   ├── IcaApplication.java
│   ├── controller/
│   │   ├── AppController.java
│   │   └── NavegacionController.java
│   ├── seguridad/
│   │   ├── JwtTokenService.java
│   │   └── SecurityConfig.java
│   ├── modelo/
│   │   ├── Categoria.java
│   │   ├── Contacto.java
│   │   ├── DetalleVenta.java
│   │   ├── Libro.java
│   │   ├── Rol.java
│   │   ├── Usuario.java
│   │   └── Venta.java
│   └── repositorio/
│       └── Interfaces de Spring Data JPA terminadas en Repository.java
└── resources/
    ├── application.properties
    └── static/
        ├── index.html
        └── frontend/
            ├── admin/
            │   ├── admin.html
            │   ├── ventas.html
            │   └── js/
            │       ├── libros.js
            │       └── ventas.js
            ├── usuario/
            │   ├── productos.html
            │   ├── carrito.html
            │   ├── contacto.html
            │   └── js/
            │       ├── catalogo.js
            │       ├── carrito.js
            │       └── contacto.js
            ├── auth/
            │   ├── login.html
            │   ├── register.html
            │   └── js/autenticacion.js
            └── compartido/
                ├── css/estilo.css
                ├── imagenes/
                │   ├── logo.png
                │   └── portada.png
                └── js/
                    ├── comun.js
                    └── categorias.js
```

## Capas y MVC

- **Presentación:** HTML, CSS y JavaScript en `static/frontend`. JavaScript consume la API y actualiza la vista.
- **Control y lógica de la aplicación:** `controller/AppController.java` recibe las solicitudes REST y conserva la lógica existente. `NavegacionController` redirige las direcciones antiguas a las nuevas páginas.
- **Persistencia:** `repositorio` contiene las interfaces de acceso a PostgreSQL. `modelo` contiene las entidades JPA que describen los datos y sus relaciones.

MVC y las capas son formas complementarias de explicar el código. En el reparto MVC, las entidades son el modelo, el controlador atiende solicitudes y el frontend presenta las vistas. Esta implementación usa vistas estáticas que consumen JSON. La lógica de negocio todavía está en `AppController`: no existe una capa de servicios independiente. Cambiar carpetas no crea por sí solo esa separación.

## Navegación y categorías

- “Explorar libros” abre el catálogo en modo invitado y limpia la identidad almacenada, conservando el carrito.
- El inicio de sesión guarda la identidad en `sessionStorage`. Se conservan mientras se recarga o navega dentro de la misma pestaña. Los datos de identidad antiguos de `localStorage` se descartan; después de esta actualización es necesario volver a iniciar sesión.
- Las comprobaciones de rol del frontend solo controlan la interfaz; el backend también aplica autorización basada en los roles del token.
- La API usa JWT sin sesión de servidor: registro e inicio de sesión son públicos; catálogo y contacto permanecen públicos; las operaciones de inventario e historial de ventas requieren rol ADMIN, y registrar una compra requiere autenticación de cliente o administrador. El frontend guarda el token en `sessionStorage` y lo envía como `Authorization: Bearer <token>`.
- Las contraseñas nuevas y las cuentas de la migración se almacenan con BCrypt. `LegacyPasswordMigration` protege al iniciar las contraseñas heredadas sin ese formato, conservando la clave utilizada por sus dueños.
- Las categorías se obtienen desde `/api/categorias`, incluidas aquellas sin libros. El filtro de inventario y el formulario de crear o editar reciben la lista completa. El formulario espera la carga y muestra un aviso si falla, permitiendo reintentar al abrirlo.
- Las categorías existentes son Sistemas y Computación, Literatura Universal, Ciencias Exactas y Negocios y Gestión. Su contenido se administra en PostgreSQL; no se generan categorías ficticias desde el navegador.
- Las direcciones antiguas `/productos.html`, `/admin.html`, `/ventas.html`, `/Ventas.html`, `/carrito.html`, `/contacto.html`, `/login.html` y `/register.html` redirigen a su nueva ubicación. Las rutas `/api` se conservan.

## Verificación

```sh
mvn -Dspring.jpa.hibernate.ddl-auto=none test
```

Este comando ejecuta la prueba de contexto existente con la base configurada y sin actualización automática del esquema. El frontend se comprueba navegando el catálogo, los selectores de categorías, los modales de inventario, las ventas y el cierre de sesión.
