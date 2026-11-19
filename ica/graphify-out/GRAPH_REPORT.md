> Mapa de la arquitectura anterior al rediseño visual del 25 de octubre de 2026. Se utilizó para localizar las pantallas, contratos y permisos existentes. Los archivos del frontend cambiaron después del análisis; este mapa no certifica su versión final.

# Graph Report - ica  (2026-10-25)

## Corpus Check
- Corpus is ~9,602 words - fits in a single context window. You may not need a graph.

## Summary
- 344 nodes · 641 edges · 14 communities (6 shown, 8 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.85)
- Token cost: unavailable input · unavailable output

## Community Hubs (Navigation)
- Catálogo y control REST
- Ventas y stock
- Autorización y JWT
- Interacciones del frontend
- Usuarios y autenticación
- Entidades y dependencias
- Categorías y repositorios
- Pantallas y navegación
- Contacto y consultas
- Rutas de compatibilidad
- Portadas y recursos
- Inicio de aplicación
- Configuración del proyecto

## God Nodes (most connected - your core abstractions)
1. `Libro` - 36 edges
2. `AppController` - 28 edges
3. `Usuario` - 27 edges
4. `Venta` - 25 edges
5. `Contacto` - 21 edges
6. `DetalleVenta` - 21 edges
7. `Rol` - 18 edges
8. `Categoria` - 17 edges
9. `NavegacionController` - 10 edges
10. `notificar()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Legacy page URL redirects` --references--> `NavegacionController`  [EXTRACTED]
  README.md → src/main/java/com/bibliotrack/ica/controller/NavegacionController.java
- `AppController contains REST and business logic` --references--> `AppController`  [EXTRACTED]
  README.md → src/main/java/com/bibliotrack/ica/controller/AppController.java
- `/api/categorias complete category list` --conceptually_related_to--> `Catalog title, author, ISBN and category filters`  [INFERRED]
  README.md → src/main/resources/static/frontend/usuario/productos.html
- `Stateless JWT bearer authentication` --conceptually_related_to--> `Email and password login form`  [EXTRACTED]
  README.md → src/main/resources/static/frontend/auth/login.html
- `Stateless JWT bearer authentication` --conceptually_related_to--> `Name, email and password registration form`  [EXTRACTED]
  README.md → src/main/resources/static/frontend/auth/register.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Static frontend view architecture** — readme_static_json_views, src_main_resources_static_index_page, src_main_resources_static_frontend_auth_login_page, src_main_resources_static_frontend_auth_register_page, src_main_resources_static_frontend_usuario_productos_page, src_main_resources_static_frontend_usuario_carrito_page, src_main_resources_static_frontend_usuario_contacto_page, src_main_resources_static_frontend_admin_admin_page, src_main_resources_static_frontend_admin_ventas_page [EXTRACTED 1.00]
- **Legacy URLs redirect to reorganized frontend pages** — readme_legacy_redirects, src_main_resources_static_frontend_auth_login_page, src_main_resources_static_frontend_auth_register_page, src_main_resources_static_frontend_usuario_productos_page, src_main_resources_static_frontend_usuario_carrito_page, src_main_resources_static_frontend_usuario_contacto_page, src_main_resources_static_frontend_admin_admin_page, src_main_resources_static_frontend_admin_ventas_page [EXTRACTED 1.00]
- **Customer pages share cart counter, authentication controls and hidden admin links** — src_main_resources_static_frontend_usuario_productos_page, src_main_resources_static_frontend_usuario_carrito_page, src_main_resources_static_frontend_usuario_contacto_page [EXTRACTED 1.00]

## Communities (14 total, 8 thin omitted)

### Community 0 - "Catálogo y control REST"
Cohesion: 0.07
Nodes (5): AppController contains REST and business logic, PostgreSQL through JPA repositories, AppController, Libro, LibroRepository

### Community 1 - "Ventas y stock"
Cohesion: 0.06
Nodes (3): DetalleVenta, Venta, VentaRepository

### Community 3 - "Interacciones del frontend"
Cohesion: 0.13
Nodes (26): cargarCategoriasAdmin(), cargarLibrosAdmin(), renderizarTablaAdmin(), cargarVentasDashboard(), renderizarTablaVentas(), obtenerCategorias(), poblarCategorias(), API_URL (+18 more)

### Community 4 - "Usuarios y autenticación"
Cohesion: 0.10
Nodes (4): Usuario, UsuarioRepository, IcaApplicationTests, AuthenticationComponentsTest

### Community 6 - "Categorías y repositorios"
Cohesion: 0.11
Nodes (3): Categoria, CategoriaRepository, DetalleVentaRepository

### Community 7 - "Pantallas y navegación"
Cohesion: 0.14
Nodes (18): /api/categorias complete category list, Per-tab sessionStorage identity and token, Create or edit book, stock and publication visibility, Local JPG, PNG or GIF cover upload with preview and 1 MB limit, Book inventory administration page, Revenue, transactions, average ticket and preferred payment KPIs, Sales history and sale-detail page, Email and password login form (+10 more)

## Knowledge Gaps
- **6 isolated node(s):** `com.bibliotrack:ica`, `PostgreSQL through JPA repositories`, `Per-tab sessionStorage identity and token`, `Local JPG, PNG or GIF cover upload with preview and 1 MB limit`, `Revenue, transactions, average ticket and preferred payment KPIs` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 116 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Libro` connect `Catálogo y control REST` to `Ventas y stock`, `Entidades y dependencias`, `Categorías y repositorios`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `com.bibliotrack:ica`, `PostgreSQL through JPA repositories`, `Per-tab sessionStorage identity and token` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Catálogo y control REST` be split into smaller, more focused modules?**
  _Cohesion score 0.07312925170068027 - nodes in this community are weakly interconnected._
- **Why does `Usuario` connect `Usuarios y autenticación` to `Autorización y JWT`, `Entidades y dependencias`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Should `Ventas y stock` be split into smaller, more focused modules?**
  _Cohesion score 0.05757575757575758 - nodes in this community are weakly interconnected._
- **Why does `AppController` connect `Catálogo y control REST` to `Ventas y stock`, `Autorización y JWT`, `Usuarios y autenticación`, `Entidades y dependencias`, `Categorías y repositorios`, `Contacto y consultas`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `Autorización y JWT` be split into smaller, more focused modules?**
  _Cohesion score 0.07716701902748414 - nodes in this community are weakly interconnected._

## Alcance y diagnóstico

La extracción contiene 81 enlaces a símbolos sin nodo explícito y 42 enlaces con extremos repetidos que se colapsan en el grafo simple. No equivale a un inventario exhaustivo de llamadas. Véase GRAPH_HEALTH.md. Se omitieron credenciales, recursos generados e imágenes superiores a 100 KB. El consumo de tokens de los subagentes no estuvo disponible y no se registra como cero.
