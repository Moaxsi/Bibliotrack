-- ==========================================================
-- BIBLIOTRACK - MIGRACION 01: IMPLEMENTACION DE LA BASE DE DATOS
-- PostgreSQL / pgAdmin 4. Preparacion de un entorno LOCAL de pruebas.
-- ==========================================================
-- COMO USAR:
-- 1. Crea una base vacia llamada bibliotrack desde pgAdmin.
--    Tambien puedes ejecutar por separado: CREATE DATABASE bibliotrack;
-- 2. Abre Query Tool conectado a esa base, pega TODO este archivo y ejecutalo.
--    CREATE DATABASE no se incluye como sentencia activa: Query Tool no cambia
--    automaticamente su conexion a la base recien creada.
-- 3. Configura el usuario y la clave de tu PostgreSQL en application.properties.
--
-- ATENCION: cada ejecucion BORRA y RECREA las siete tablas de BiblioTrack,
-- incluidos usuarios, ventas, libros y mensajes. No usar sobre datos que conservar.
-- Ejecuta el script con la aplicacion detenida y solo en tu entorno de pruebas.
-- Toda la instalacion se confirma en una transaccion; ante un error, usa ROLLBACK.
--
-- CUENTAS DE PRUEBA (las claves se guardan con BCrypt):
-- Administrador: admin@bibliotrack.com / admin123
-- Cliente:       carlos@gmail.com     / cliente123
--
-- RESULTADO: 7 tablas, 2 roles, 2 usuarios, 4 categorias, 34 libros activos,
-- una venta de ejemplo con 2 detalles, restricciones e indices.
-- Los precios en soles y las existencias son datos ficticios para pruebas.
-- Tres portadas del catalogo usan archivos incluidos en el frontend del proyecto.

BEGIN;
SET LOCAL search_path TO public;

-- ==========================================================
-- 1. REINICIO DEL ENTORNO DE PRUEBAS
-- ==========================================================
DROP TABLE IF EXISTS detalle_ventas CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS libros CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS contacto CASCADE;

-- ==========================================================
-- 2. ESTRUCTURA E INTEGRIDAD
-- ==========================================================
CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(150)
);

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_rol INT NOT NULL REFERENCES roles(id_rol),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE libros (
    id_libro SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL REFERENCES categorias(id_categoria),
    isbn VARCHAR(20) NOT NULL UNIQUE,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_venta DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    url_portada VARCHAR(500),
    estado VARCHAR(50) NOT NULL DEFAULT 'Activo',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT libros_stock_no_negativo CHECK (stock >= 0),
    CONSTRAINT libros_precio_positivo CHECK (precio_venta > 0)
);

CREATE TABLE ventas (
    id_venta SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    tipo_comprobante VARCHAR(50) NOT NULL DEFAULT 'Boleta',
    estado VARCHAR(30) NOT NULL DEFAULT 'Completada',
    CONSTRAINT ventas_total_positivo CHECK (total > 0)
);

CREATE TABLE detalle_ventas (
    id_detalle_venta SERIAL PRIMARY KEY,
    id_venta INT NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    id_libro INT NOT NULL REFERENCES libros(id_libro),
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    CONSTRAINT detalle_cantidad_positiva CHECK (cantidad > 0 AND precio_unitario > 0 AND subtotal > 0)
);

CREATE TABLE contacto (
    id_contacto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    asunto VARCHAR(100) NOT NULL,
    mensaje TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ventas_cliente_fecha_idx ON ventas (id_usuario, id_venta DESC);
CREATE INDEX detalle_ventas_venta_idx ON detalle_ventas (id_venta);

-- ==========================================================
-- 3. ROLES, CUENTAS Y CATEGORIAS INICIALES
-- ==========================================================
INSERT INTO roles (nombre, descripcion) VALUES
('ADMIN', 'Acceso completo al catalogo, usuarios, control de stock y reportes'),
('CLIENTE', 'Acceso para consulta de libros, busqueda, compras e historial propio');

-- Hashes BCrypt preparados para las claves de prueba indicadas en la cabecera.
-- No requieren pgcrypto ni extensiones adicionales de PostgreSQL.
INSERT INTO usuarios (id_rol, nombre, email, password, estado) VALUES
(1, 'Administrador BiblioTrack', 'admin@bibliotrack.com', '$2a$10$y4tkQMPduaJFWMIEaP8jyezAxvn1wPKK0Iu8vk.KSaNpUyxwfikd6', 'Activo'),
(2, 'Carlos Mendoza', 'carlos@gmail.com', '$2a$10$9eJPGZZ0yvGO8KiFD5RBc.G1zDQo4581qPa9rUNR/J6m3bQ7R9wL6', 'Activo');

INSERT INTO categorias (nombre, descripcion) VALUES
('Sistemas y Computación', 'Libros de ingeniería, algoritmos, bases de datos y arquitectura'),
('Literatura Universal', 'Novelas clásicas, narrativa histórica y ficción'),
('Ciencias Exactas', 'Matemáticas, física, estadística y cálculo'),
('Negocios y Gestión', 'Administración, finanzas, liderazgo y emprendimiento');

-- ==========================================================
-- 4. LOS CUATRO LIBROS DEL SCRIPT BASE
-- ==========================================================
-- ISBN sin guiones y estado Activo desde la insercion, para que se vean
-- inmediatamente en el catalogo y puedan utilizarse en las compras.
INSERT INTO libros (id_categoria, isbn, titulo, autor, descripcion, precio_venta, stock, url_portada, estado) VALUES
(1, '9780132350884', 'Clean Code', 'Robert C. Martin', 'Manual de estilo y buenas prácticas para desarrollo ágil de software.', 120.00, 15, 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd9', 'Activo'),
(1, '9780134685991', 'Effective Java', 'Joshua Bloch', 'Guía fundamental para el diseño y programación eficiente en Java.', 135.50, 8, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c', 'Activo'),
(2, '9788420471839', 'Cien Años de Soledad', 'Gabriel García Márquez', 'Obra cumbre del realismo mágico latinoamericano.', 65.00, 20, 'https://images.unsplash.com/photo-1512820790803-83ca734da794', 'Activo'),
(4, '9780062457714', 'El Método Lean Startup', 'Eric Ries', 'Cómo crear empresas de éxito utilizando la innovación continua.', 85.00, 12, 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6', 'Activo');

-- ==========================================================
-- 5. CATALOGO DE 30 LIBROS ADICIONALES
-- ==========================================================
-- Se conservan las fichas, portadas y fuentes del catalogo anterior.
WITH nuevos (id_categoria, isbn, titulo, autor, descripcion, precio_venta, stock, url_portada, estado) AS (
  VALUES
  -- 01. Fuente: https://www.sbs.com.pe/rios-profundos-los-9788420461885.html
  (2, '9788420461885', 'Los ríos profundos', 'José María Arguedas', 'Ernesto, un adolescente en un internado de Abancay, descubre las tensiones entre el mundo andino y el poder social. Una novela de formación sobre identidad, lengua y pertenencia.', 79.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9788420461885_1.jpeg', 'Activo'),
  -- 02. Fuente: https://www.sbs.com.pe/todas-las-sangres.html
  (2, '9786124395635', 'Todas las sangres', 'José María Arguedas', 'Las ambiciones de dos hermanos y la llegada de intereses mineros transforman una comunidad andina. Arguedas reúne las distintas voces de un Perú atravesado por desigualdades y cambios.', 69.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786124395635_ydqjanzfmytasvs5.jpg', 'Activo'),
  -- 03. Fuente: https://www.peisa.com.pe/producto/un-mundo-para-julius-de-alfredo-bryce-echenique
  (2, '9786123052362', 'Un mundo para Julius', 'Alfredo Bryce Echenique', 'La infancia de Julius en una familia acomodada de Lima revela las distancias entre los salones de la élite y la vida de sus trabajadores. Una mirada sensible e irónica sobre la sociedad peruana.', 49.90, 10, 'https://cdn.tiendabox.co/tienda_010118/5796cf338bfd805407194ea91eafd5caef66abbe_10118_1774965409.jpg?w=1280&q=85', 'Activo'),
  -- 04. Fuente: https://www.sbs.com.pe/cuentos-completos-ribeyro.html
  (2, '9786125020116', 'Cuentos completos', 'Julio Ramón Ribeyro', 'Los relatos de Ribeyro retratan personajes vulnerables, pequeñas derrotas y contradicciones de la vida cotidiana. Esta recopilación reúne su narrativa breve y su mirada sobre Lima y la condición humana.', 109.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786125020116_1.jpeg', 'Activo'),
  -- 05. Fuente: https://www.sbs.com.pe/hora-azul-db-9786124346538.html
  (2, '9786124346538', 'La hora azul', 'Alonso Cueto', 'Un abogado limeño descubre aspectos inquietantes del pasado militar de su padre. La investigación lo acerca a las víctimas del conflicto armado y cuestiona la tranquilidad de su propia vida.', 49.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786124346538_1.jpeg', 'Activo'),
  -- 06. Fuente: https://www.sbs.com.pe/conversacion-en-la-catedral-50-aniversar-9786125020710.html
  (2, '9786125020710', 'Conversación en La Catedral', 'Mario Vargas Llosa', 'Una larga conversación entre Santiago Zavala y Ambrosio reconstruye vidas marcadas por la dictadura de Odría. Una novela sobre corrupción, poder y desencanto en el Perú.', 99.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786125020710.jpg', 'Activo'),
  -- 07. Fuente: https://www.sbs.com.pe/el-amor-en-los-tiempos-del-colera-9786124262777.html
  (2, '9786124262777', 'El amor en los tiempos del cólera', 'Gabriel García Márquez', 'Florentino Ariza mantiene durante décadas su amor por Fermina Daza. Entre recuerdos, envejecimiento y segundas oportunidades, la novela explora las distintas formas del afecto y la espera.', 59.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786124262777_2.jpeg', 'Activo'),
  -- 08. Fuente: https://www.sbs.com.pe/cronica-de-una-muerte-anunciada-9786124262753.html
  (2, '9786124262753', 'Crónica de una muerte anunciada', 'Gabriel García Márquez', 'La reconstrucción del asesinato de Santiago Nasar muestra cómo una comunidad entera conoce una tragedia antes de que ocurra. Una narración breve sobre honor, memoria y responsabilidad colectiva.', 39.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786124262753_2.jpeg', 'Activo'),
  -- 09. Fuente: https://www.sbs.com.pe/1984-9788419260154.html
  (2, '9788419260154', '1984', 'George Orwell', 'Winston Smith vive bajo un régimen que vigila los actos y manipula el pasado. Una distopía sobre el control político, el lenguaje y la resistencia de la conciencia individual.', 49.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9788419260154.jpg', 'Activo'),
  -- 10. Fuente: https://www.sbs.com.pe/rebelion-en-la-granja-9786124262043.html
  (2, '9786124262043', 'Rebelión en la granja', 'George Orwell', 'Los animales de una granja se rebelan contra su dueño buscando igualdad. La transformación de sus nuevos dirigentes convierte la fábula en una crítica de la propaganda y el abuso de poder.', 34.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786124262043_2.jpeg', 'Activo'),
  -- 11. Fuente: https://www.sbs.com.pe/el-principito.html
  (2, '9788410378810', 'El principito', 'Antoine de Saint-Exupéry', 'Un pequeño viajero comparte sus encuentros y preguntas con un aviador perdido en el desierto. Un relato ilustrado sobre amistad, cuidado y la manera en que miramos el mundo.', 29.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9788410378810_1.jpeg', 'Activo'),
  -- 12. Fuente: https://www.sbs.com.pe/don-quijote-de-la-mancha-rae-latam-9788420412146.html
  (2, '9788420412146', 'Don Quijote de la Mancha', 'Miguel de Cervantes Saavedra', 'Alonso Quijano sale a recorrer los caminos como caballero andante junto a Sancho Panza. Sus aventuras enfrentan imaginación y realidad en una obra central de la literatura en español.', 89.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9788420412146_1.jpeg', 'Activo'),
  -- 13. Fuente: https://www.informit.com/store/clean-architecture-a-craftsmans-guide-to-software-structure-9780134494166
  (1, '9780134494166', 'Clean Architecture', 'Robert C. Martin', 'Explica principios para organizar sistemas de software y proteger las reglas de negocio de los detalles tecnológicos. Aborda dependencias, componentes y decisiones arquitectónicas que facilitan la evolución del código.', 179.90, 10, 'https://www.informit.com/ShowCover.aspx?isbn=0134494164', 'Activo'),
  -- 14. Fuente: https://www.informit.com/store/pragmatic-programmer-your-journey-to-mastery-20th-anniversary-9780135957059
  (1, '9780135957059', 'The Pragmatic Programmer: Your Journey to Mastery, 20th Anniversary Edition', 'David Thomas y Andrew Hunt', 'Consejos prácticos para desarrollar software de forma reflexiva y adaptable. La segunda edición trata automatización, diseño flexible, comunicación y responsabilidad profesional mediante ejemplos y ejercicios.', 189.90, 10, 'https://www.informit.com/ShowCover.aspx?isbn=0135957052', 'Activo'),
  -- 15. Fuente: https://www.informit.com/store/refactoring-improving-the-design-of-existing-code-9780134757599
  (1, '9780134757599', 'Refactoring: Improving the Design of Existing Code, 2nd Edition', 'Martin Fowler', 'Presenta técnicas para mejorar la estructura interna del software manteniendo su comportamiento. Incluye señales de diseño problemático, pruebas y transformaciones explicadas mediante ejemplos en JavaScript.', 199.90, 10, 'https://www.informit.com/ShowCover.aspx?isbn=0134757599', 'Activo'),
  -- 16. Fuente: https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-software-9780201633610
  (1, '9780201633610', 'Design Patterns: Elements of Reusable Object-Oriented Software', 'Erich Gamma, Richard Helm, Ralph Johnson y John Vlissides', 'Catálogo de patrones de diseño orientado a objetos que explica problemas recurrentes y soluciones reutilizables. Describe cuándo aplicar cada patrón y las consecuencias de integrarlo en un sistema.', 189.90, 10, 'https://www.informit.com/ShowCover.aspx?isbn=0201633612', 'Activo'),
  -- 17. Fuente: https://www.informit.com/store/java-concurrency-in-practice-9780321349606
  (1, '9780321349606', 'Java Concurrency in Practice', 'Brian Goetz, Tim Peierls, Joshua Bloch, Joseph Bowbeer, David Holmes y Doug Lea', 'Guía para construir programas concurrentes en Java con seguridad y buen rendimiento. Estudia sincronización, publicación de objetos, ejecutores, pruebas y el modelo de memoria del lenguaje.', 179.90, 10, 'https://www.informit.com/ShowCover.aspx?isbn=0321349601', 'Activo'),
  -- 18. Fuente: https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/
  (1, '9780262046305', 'Introduction to Algorithms, 4th Edition', 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest y Clifford Stein', 'Referencia de algoritmos y estructuras de datos con análisis de complejidad y demostraciones. Incluye técnicas de diseño, grafos, programación dinámica y algoritmos para distintas aplicaciones.', 249.90, 10, 'https://mit-press-new-us.imgix.net/covers/9780262046305.jpg?auto=format&w=700', 'Activo'),
  -- 19. Fuente: https://nostarch.com/node/691
  (1, '9781718502703', 'Python Crash Course, 3rd Edition', 'Eric Matthes', 'Introducción práctica a Python que combina fundamentos del lenguaje con proyectos. Incluye un videojuego, visualización de datos y una aplicación web para aplicar lo aprendido.', 169.90, 10, '/frontend/compartido/imagenes/portadas/9781718502703.jpg', 'Activo'),
  -- 20. Fuente: https://dataintensive.net/buy.html
  (1, '9781449373320', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Explica los fundamentos de sistemas de datos fiables, escalables y mantenibles. Compara bases de datos, replicación, particionamiento, transacciones y procesamiento por lotes y flujos.', 219.90, 10, 'https://dataintensive.net/images/book-cover.png', 'Activo'),
  -- 21. Fuente: https://www.sbs.com.pe/habitos-atomicos.html
  (4, '9786125027580', 'Hábitos atómicos', 'James Clear', 'Método para construir hábitos sostenibles mediante cambios pequeños y repetidos. Explica cómo adaptar el entorno y los sistemas cotidianos para facilitar conductas útiles y reducir las que dificultan los objetivos.', 59.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786125027580_1.jpeg', 'Activo'),
  -- 22. Fuente: https://www.sbs.com.pe/la-psicologia-del-dinero-9786124327506.html
  (4, '9786124327506', 'La psicología del dinero', 'Morgan Housel', 'Historias y reflexiones sobre cómo las emociones, las experiencias y las expectativas influyen en las decisiones financieras. Examina riesgo, ahorro, paciencia y la relación personal con el dinero.', 69.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786124327506_2.jpeg', 'Activo'),
  -- 23. Fuente: https://www.sbs.com.pe/el-hombre-mas-rico-de-babilonia-9788417963552.html
  (4, '9788417963552', 'El hombre más rico de Babilonia', 'George S. Clason', 'Parábolas ambientadas en la antigua Babilonia que presentan principios de ahorro y administración del dinero. Una introducción narrativa a la disciplina financiera y la construcción de patrimonio.', 39.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9788417963552.jpg', 'Activo'),
  -- 24. Fuente: https://www.sbs.com.pe/los-7-habitos-de-la-gente-altamente-efectiva-9786125027405.html
  (4, '9786125027405', 'Los 7 hábitos de la gente altamente efectiva', 'Stephen R. Covey', 'Propuesta de desarrollo personal y profesional basada en principios. Aborda proactividad, prioridades, colaboración y renovación de capacidades para mejorar la forma de trabajar y relacionarse.', 69.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9786125027405.jpeg', 'Activo'),
  -- 25. Fuente: https://www.planetadelibros.com.pe/libro-de-cero-a-uno/319342
  (4, '9788498754902', 'De cero a uno', 'Peter Thiel y Blake Masters', 'Reflexiones sobre la creación de empresas capaces de aportar algo nuevo. Explora innovación, ventajas competitivas, equipos y decisiones estratégicas para construir negocios diferenciados.', 49.90, 10, '/frontend/compartido/imagenes/portadas/9788498754902.jpg', 'Activo'),
  -- 26. Fuente: https://www.planetadelibros.com.pe/libro-el-inversor-inteligente/273979
  (4, '9789584248930', 'El inversor inteligente', 'Benjamin Graham', 'Obra clásica de inversión en valor que distingue inversión y especulación. Desarrolla conceptos como margen de seguridad, disciplina y evaluación de empresas, con comentarios de Jason Zweig.', 99.90, 10, '/frontend/compartido/imagenes/portadas/9789584248930.jpg', 'Activo'),
  -- 27. Fuente: https://cengagelatam.editorialdc.com/libros/calculo-de-una-variable-trascendentes-tempranas/
  (3, '9786075700304', 'Cálculo de una variable. Trascendentes tempranas', 'James Stewart, Daniel Clegg y Saleem Watson', 'Texto universitario sobre funciones, límites, derivadas e integrales. Incluye aplicaciones, técnicas de integración, ecuaciones diferenciales y series, con ejercicios orientados a comprender y resolver problemas.', 199.90, 10, 'https://cengagelatam.editorialdc.com/wp-content/uploads/2024/08/9786075700304.jpg', 'Activo'),
  -- 28. Fuente: https://cengagelatam.editorialdc.com/libros/precalculo/
  (3, '9786075702094', 'Precálculo', 'James Stewart, Lothar Redlin y Saleem Watson', 'Preparación para el cálculo mediante álgebra, funciones, gráficas y trigonometría. Combina comprensión conceptual, modelado y práctica para fortalecer las bases matemáticas universitarias.', 189.90, 10, 'https://cengagelatam.editorialdc.com/wp-content/uploads/2024/08/9786075702094.jpg', 'Activo'),
  -- 29. Fuente: https://libreria.ues.edu.sv/fisica-universitaria-con-fisica-moderna.html
  (3, '9786073244398', 'Física universitaria con física moderna, volumen 1, 14.ª edición', 'Hugh D. Young y Roger A. Freedman', 'Desarrolla los fundamentos de mecánica, ondas y termodinámica con ejemplos y problemas. El primer volumen de Sears y Zemansky está orientado a cursos universitarios de ciencias e ingeniería.', 219.90, 10, 'https://libreria.ues.edu.sv/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/s/c/scan_0058_4.jpg', 'Activo'),
  -- 30. Fuente: https://www.sbs.com.pe/algebra.html
  (3, '9789463598071', 'Álgebra: de los algoritmos a los vectores', 'Michael Willers', 'Un recorrido por las ideas y la historia del álgebra, desde sus orígenes hasta aplicaciones actuales. Incluye problemas para explorar conceptos y conexiones matemáticas de forma accesible.', 49.90, 10, 'https://www.sbs.com.pe/media/catalog/product/9/7/9789463598071_1.jpeg', 'Activo')
)
INSERT INTO libros (id_categoria, isbn, titulo, autor, descripcion, precio_venta, stock, url_portada, estado)
SELECT n.id_categoria, n.isbn, n.titulo, n.autor, n.descripcion, n.precio_venta, n.stock, n.url_portada, n.estado
FROM nuevos AS n
WHERE NOT EXISTS (SELECT 1 FROM libros AS l WHERE regexp_replace(l.isbn, '[^0-9]', '', 'g') = n.isbn)
ON CONFLICT (isbn) DO NOTHING
RETURNING id_libro, isbn, titulo;

-- ==========================================================
-- 6. VENTA DE PRUEBA E HISTORIAL DEL CLIENTE
-- ==========================================================
INSERT INTO ventas (id_usuario, total, metodo_pago, tipo_comprobante, estado)
SELECT id_usuario, 185.00, 'Efectivo', 'Boleta', 'Completada'
FROM usuarios WHERE email = 'carlos@gmail.com';

INSERT INTO detalle_ventas (id_venta, id_libro, cantidad, precio_unitario, subtotal)
SELECT v.id_venta, l.id_libro, 1, l.precio_venta, l.precio_venta
FROM ventas v
JOIN usuarios u ON u.id_usuario = v.id_usuario
CROSS JOIN libros l
WHERE u.email = 'carlos@gmail.com'
  AND l.isbn IN ('9780132350884', '9788420471839');

-- La venta de ejemplo tambien descuenta existencias: Clean Code queda en 14
-- y Cien Anos de Soledad en 19. El resto conserva su stock inicial.
UPDATE libros l
SET stock = l.stock - vendidos.cantidad
FROM (SELECT id_libro, SUM(cantidad)::INT AS cantidad FROM detalle_ventas GROUP BY id_libro) vendidos
WHERE l.id_libro = vendidos.id_libro;

COMMIT;

-- ==========================================================
-- 7. RESUMEN DE LA INSTALACION
-- ==========================================================
SELECT 'roles' AS tabla, COUNT(*) AS registros FROM roles
UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
UNION ALL SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL SELECT 'libros', COUNT(*) FROM libros
UNION ALL SELECT 'ventas', COUNT(*) FROM ventas
UNION ALL SELECT 'detalle_ventas', COUNT(*) FROM detalle_ventas
UNION ALL SELECT 'contacto', COUNT(*) FROM contacto;
