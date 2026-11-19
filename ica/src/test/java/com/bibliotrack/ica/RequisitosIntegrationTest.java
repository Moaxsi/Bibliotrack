package com.bibliotrack.ica;

import com.bibliotrack.ica.modelo.*;
import com.bibliotrack.ica.repositorio.*;
import com.bibliotrack.ica.seguridad.JwtTokenService;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext
class RequisitosIntegrationTest {
    private static final String SCHEMA = "test_requisitos_" + UUID.randomUUID().toString().replace("-", "");
    private static final Properties DB = new Properties();
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    @Autowired Environment environment;
    @Autowired UsuarioRepository usuarios;
    @Autowired RolRepository roles;
    @Autowired LibroRepository libros;
    @Autowired CategoriaRepository categorias;
    @Autowired VentaRepository ventas;
    @Autowired DetalleVentaRepository detalles;
    @Autowired JwtTokenService tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.bibliotrack.ica.seguridad.LegacyPasswordMigration migracion;
    Usuario cliente, otro, admin;
    String token, tokenOtro, tokenAdmin;
    Libro libro;
    Categoria categoria;

    @DynamicPropertySource
    static void baseAislada(DynamicPropertyRegistry registry) throws Exception {
        try (var input = RequisitosIntegrationTest.class.getResourceAsStream("/application.properties")) { DB.load(input); }
        try (var connection = DriverManager.getConnection(DB.getProperty("spring.datasource.url"), DB.getProperty("spring.datasource.username"), DB.getProperty("spring.datasource.password")); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + SCHEMA);
        }
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("spring.jpa.show-sql", () -> "false");
        registry.add("server.port", () -> "0");
    }

    @AfterAll
    static void limpiarEsquema() throws Exception {
        try (var connection = DriverManager.getConnection(DB.getProperty("spring.datasource.url"), DB.getProperty("spring.datasource.username"), DB.getProperty("spring.datasource.password")); var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @BeforeEach
    void preparar() {
        detalles.deleteAll(); ventas.deleteAll(); libros.deleteAll(); usuarios.deleteAll(); categorias.deleteAll(); roles.deleteAll();
        Rol clienteRol = roles.save(new Rol(null, "CLIENTE")), adminRol = roles.save(new Rol(null, "ADMIN"));
        cliente = cuenta("Cliente", "cliente@test.local", clienteRol);
        otro = cuenta("Otro", "otro@test.local", clienteRol);
        admin = cuenta("Administrador", "admin@test.local", adminRol);
        token = tokens.generateToken(cliente); tokenOtro = tokens.generateToken(otro); tokenAdmin = tokens.generateToken(admin);
        categoria = new Categoria(); categoria.setNombre("Prueba"); categorias.save(categoria);
        libro = new Libro(); libro.setIsbn("9780132350884"); libro.setTitulo("Clean Code"); libro.setAutor("Robert Martin");
        libro.setCategoria(categoria); libro.setPrecioVenta(new BigDecimal("25.50")); libro.setStock(5); libro.setEstado("Activo"); libros.save(libro);
    }

    Usuario cuenta(String nombre, String email, Rol rol) {
        Usuario u = new Usuario(); u.setNombre(nombre); u.setEmail(email); u.setRol(rol); u.setEstado("Activo"); u.setPassword(encoder.encode("prueba123"));
        return usuarios.save(u);
    }
    HttpResponse<String> pedir(String method, String path, String auth, Object body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + environment.getProperty("local.server.port") + "/api/" + path));
        if (auth != null) request.header("Authorization", "Bearer " + auth);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
    Map<String, Object> compra(int cantidad) { return Map.of("items", List.of(Map.of("idLibro", libro.getIdLibro(), "cantidad", cantidad))); }
    Map<String, Object> datosUsuario(Usuario u, Integer rol, String estado) { return Map.of("nombre", u.getNombre(), "email", u.getEmail(), "idRol", rol, "estado", estado); }

    @Test void historialSoloMuestraComprasPropias() throws Exception {
        var venta = pedir("POST", "ventas", token, compra(2)); assertEquals(200, venta.statusCode(), venta.body());
        int id = JSON.readTree(venta.body()).get("idVenta").asInt();
        var historial = pedir("GET", "mis-compras", token, null); assertEquals(1, JSON.readTree(historial.body()).size());
        assertEquals(0, JSON.readTree(pedir("GET", "mis-compras", tokenOtro, null).body()).size());
        assertEquals(404, pedir("GET", "mis-compras/" + id + "/detalle", tokenOtro, null).statusCode());
        var detalle = pedir("GET", "mis-compras/" + id + "/detalle", token, null);
        assertEquals(2, JSON.readTree(detalle.body()).get(0).get("cantidad").asInt());
        assertEquals(3, libros.findById(libro.getIdLibro()).orElseThrow().getStock());
    }

    @Test void protegeUsuariosVentasYRoles() throws Exception {
        for (String path : List.of("usuarios", "roles", "ventas", "mis-compras")) assertEquals(401, pedir("GET", path, null, null).statusCode());
        for (String path : List.of("usuarios", "roles", "ventas")) assertEquals(403, pedir("GET", path, token, null).statusCode());
        var lista = pedir("GET", "usuarios", tokenAdmin, null); assertEquals(200, lista.statusCode()); assertFalse(lista.body().contains("password"));
        assertFalse(lista.body().contains("$2a$"));
    }

    @Test void conservaCabecerasDeSeguridadYRechazaOrigenExterno() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:"
                + environment.getProperty("local.server.port") + "/")).GET().build();
        var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        assertEquals("nosniff", response.headers().firstValue("X-Content-Type-Options").orElseThrow());
        assertEquals("DENY", response.headers().firstValue("X-Frame-Options").orElseThrow());
        String csp = response.headers().firstValue("Content-Security-Policy").orElseThrow();
        assertTrue(csp.contains("object-src 'none'"));
        assertTrue(csp.contains("frame-ancestors 'none'"));
        var externo = HttpRequest.newBuilder(URI.create("http://localhost:"
                + environment.getProperty("local.server.port") + "/api/libros"))
                .header("Origin", "https://origen-no-autorizado.example").GET().build();
        var bloqueado = HTTP.send(externo, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, bloqueado.statusCode());
        assertTrue(bloqueado.headers().firstValue("Access-Control-Allow-Origin").isEmpty());
        var preflight = HttpRequest.newBuilder(externo.uri())
                .header("Origin", "https://origen-no-autorizado.example")
                .header("Access-Control-Request-Method", "POST")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        var respuestaPreflight = HTTP.send(preflight, HttpResponse.BodyHandlers.ofString());
        assertTrue(respuestaPreflight.headers().firstValue("Access-Control-Allow-Origin").isEmpty());
    }

    @Test void rechazaCantidadesInvalidasYAcumulaRepetidos() throws Exception {
        for (Object cantidad : List.of(0, -1, 1.5, "abc", 2147483648L)) {
            var res = pedir("POST", "ventas", token, Map.of("items", List.of(Map.of("idLibro", libro.getIdLibro(), "cantidad", cantidad))));
            assertEquals(400, res.statusCode(), res.body());
        }
        var repetidos = Map.of("items", List.of(Map.of("idLibro", libro.getIdLibro(), "cantidad", 4), Map.of("idLibro", libro.getIdLibro(), "cantidad", 4)));
        assertEquals(400, pedir("POST", "ventas", token, repetidos).statusCode());
        assertEquals(0, ventas.count()); assertEquals(5, libros.findById(libro.getIdLibro()).orElseThrow().getStock());
    }

    @Test void fusionaLineasYCalculaImportesEnServidor() throws Exception {
        var datos = Map.of("total", 0, "items", List.of(Map.of("idLibro", libro.getIdLibro(), "cantidad", 1, "precioUnitario", 0), Map.of("idLibro", libro.getIdLibro(), "cantidad", 2)));
        var response = pedir("POST", "ventas", token, datos); assertEquals(200, response.statusCode(), response.body());
        assertEquals(76.5, JSON.readTree(response.body()).get("total").asDouble());
        assertEquals(1, detalles.count()); assertEquals(3, detalles.findAll().getFirst().getCantidad());
    }

    @Test void ventaInvalidaNoGuardaCabeceraNiDescuentaOtrosLibros() throws Exception {
        var datos = Map.of("items", List.of(Map.of("idLibro", libro.getIdLibro(), "cantidad", 1), Map.of("idLibro", 999999, "cantidad", 1)));
        assertEquals(400, pedir("POST", "ventas", token, datos).statusCode());
        assertEquals(0, ventas.count()); assertEquals(0, detalles.count()); assertEquals(5, libros.findById(libro.getIdLibro()).orElseThrow().getStock());
    }

    @Test void ventasSimultaneasNoSobrevenden() throws Exception {
        var inicio = new CountDownLatch(1); var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> tarea = () -> { inicio.await(); return pedir("POST", "ventas", token, compra(4)).statusCode(); };
            var a = pool.submit(tarea); var b = pool.submit(tarea); inicio.countDown();
            var statuses = new ArrayList<>(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS))); Collections.sort(statuses);
            assertEquals(List.of(200, 400), statuses); assertEquals(1, ventas.count()); assertEquals(1, libros.findById(libro.getIdLibro()).orElseThrow().getStock());
        } finally { pool.shutdownNow(); }
    }

    @Test void soloAdminPuedeRegistrarParaOtroCliente() throws Exception {
        var datos = new HashMap<String, Object>(compra(1)); datos.put("idCliente", otro.getIdUsuario());
        assertEquals(403, pedir("POST", "ventas", token, datos).statusCode());
        assertEquals(200, pedir("POST", "ventas", tokenAdmin, datos).statusCode());
        assertEquals(otro.getIdUsuario(), ventas.findAll().getFirst().getIdUsuario());
    }

    @Test void cambiosDeRolYSuspensionInvalidanPermisosAnteriores() throws Exception {
        var rolAdmin = admin.getRol().getIdRol();
        assertEquals(200, pedir("PUT", "usuarios/" + cliente.getIdUsuario(), tokenAdmin, datosUsuario(cliente, rolAdmin, "Activo")).statusCode());
        assertEquals(401, pedir("GET", "mis-compras", token, null).statusCode());
        var actualizado = usuarios.findById(cliente.getIdUsuario()).orElseThrow();
        String nuevoToken = tokens.generateToken(actualizado);
        assertEquals(200, pedir("GET", "usuarios", nuevoToken, null).statusCode());
        assertEquals(200, pedir("PUT", "usuarios/" + cliente.getIdUsuario(), tokenAdmin, datosUsuario(cliente, rolAdmin, "Suspendido")).statusCode());
        assertEquals(401, pedir("GET", "usuarios", nuevoToken, null).statusCode());
    }

    @Test void administradorNoPuedeQuitarseSuAcceso() throws Exception {
        assertEquals(400, pedir("PUT", "usuarios/" + admin.getIdUsuario(), tokenAdmin, datosUsuario(admin, cliente.getRol().getIdRol(), "Activo")).statusCode());
        assertEquals(400, pedir("PUT", "usuarios/" + admin.getIdUsuario(), tokenAdmin, datosUsuario(admin, admin.getRol().getIdRol(), "Inactivo")).statusCode());
    }

    @Test void registroProtegeContrasenaYNoAceptaRolPublico() throws Exception {
        var body = Map.of("nombre", "Nueva cuenta", "email", "nueva@test.local", "password", "secreto123", "idRol", admin.getRol().getIdRol());
        assertEquals(200, pedir("POST", "register", null, body).statusCode());
        Usuario u = usuarios.findByEmailIgnoreCase("nueva@test.local").orElseThrow();
        assertEquals("CLIENTE", u.getRol().getNombre()); assertNotEquals("secreto123", u.getPassword()); assertTrue(encoder.matches("secreto123", u.getPassword()));
        assertEquals(400, pedir("POST", "register", null, Map.of("nombre", " ", "email", "no-correo", "password", "123")).statusCode());
    }

    @Test void librosValidanDatosYBusquedaIsbnConCategoria() throws Exception {
        var datos = new HashMap<String,Object>(Map.of("isbn", "978-0132350884", "titulo", "Duplicado", "autor", "Autor", "precioVenta", 10, "stock", 1, "idCategoria", categoria.getIdCategoria()));
        assertEquals(400, pedir("POST", "libros", tokenAdmin, datos).statusCode());
        for (var invalido : List.of(Map.of("stock", -1), Map.of("precioVenta", -2), Map.of("titulo", " "), Map.of("idCategoria", 99999))) assertEquals(400, pedir("PUT", "libros/" + libro.getIdLibro(), tokenAdmin, invalido).statusCode());
        assertEquals(1, JSON.readTree(pedir("GET", "libros?buscar=978-0132350884&categoria=" + categoria.getIdCategoria(), null, null).body()).size());
        assertEquals(0, JSON.readTree(pedir("GET", "libros?buscar=ausente&categoria=" + categoria.getIdCategoria(), null, null).body()).size());
    }

    @Test void libroInactivoNoPuedeComprarse() throws Exception {
        libro.setEstado("Inactivo"); libros.save(libro);
        assertEquals(400, pedir("POST", "ventas", token, compra(1)).statusCode()); assertEquals(0, ventas.count());
    }

    @Test void errorAlGuardarDetalleRevierteTodaLaVenta() throws Exception {
        jdbc.execute("ALTER TABLE " + SCHEMA + ".detalle_ventas ADD CONSTRAINT fallo_controlado CHECK (cantidad < 2)");
        try {
            assertEquals(409, pedir("POST", "ventas", token, compra(2)).statusCode());
            assertEquals(0, ventas.count()); assertEquals(0, detalles.count());
            assertEquals(5, libros.findById(libro.getIdLibro()).orElseThrow().getStock());
        } finally { jdbc.execute("ALTER TABLE " + SCHEMA + ".detalle_ventas DROP CONSTRAINT fallo_controlado"); }
    }

    @Test void adminCreaEditaUsuariosYConservaPasswordSiQuedaVacia() throws Exception {
        var datos = new HashMap<String,Object>(Map.of("nombre", "Nueva", "email", "nueva@test.local", "password", "secreto123", "idRol", cliente.getRol().getIdRol(), "estado", "Activo"));
        var creado = pedir("POST", "usuarios", tokenAdmin, datos); assertEquals(200, creado.statusCode(), creado.body());
        int id = JSON.readTree(creado.body()).get("idUsuario").asInt();
        String hash = usuarios.findById(id).orElseThrow().getPassword();
        datos.put("nombre", "Editada"); datos.put("password", "");
        assertEquals(200, pedir("PUT", "usuarios/" + id, tokenAdmin, datos).statusCode());
        Usuario editado = usuarios.findById(id).orElseThrow(); assertEquals("Editada", editado.getNombre()); assertEquals(hash, editado.getPassword());
        datos.put("email", admin.getEmail()); assertEquals(400, pedir("PUT", "usuarios/" + id, tokenAdmin, datos).statusCode());
    }

    @Test void noEliminaLibrosQueTienenHistorialDeCompras() throws Exception {
        assertEquals(200, pedir("POST", "ventas", token, compra(1)).statusCode());
        assertEquals(409, pedir("DELETE", "libros/" + libro.getIdLibro(), tokenAdmin, null).statusCode());
        assertTrue(libros.existsById(libro.getIdLibro()));
    }

    @Test void cambiarPasswordRevocaTokenAnterior() throws Exception {
        var datos = new HashMap<String,Object>(datosUsuario(cliente, cliente.getRol().getIdRol(), "Activo"));
        datos.put("password", "nueva-clave123");
        assertEquals(200, pedir("PUT", "usuarios/" + cliente.getIdUsuario(), tokenAdmin, datos).statusCode());
        assertEquals(401, pedir("GET", "mis-compras", token, null).statusCode());
        assertEquals(200, pedir("POST", "login", null, Map.of("email", cliente.getEmail(), "password", "nueva-clave123")).statusCode());
        assertEquals(401, pedir("POST", "login", null, Map.of("email", cliente.getEmail(), "password", "prueba123")).statusCode());
    }

    @Test void migraPasswordHeredadaUnaSolaVezSinCambiarLaClave() throws Exception {
        cliente.setPassword("clave-antigua123"); usuarios.save(cliente);
        migracion.run(null);
        String protegida = usuarios.findById(cliente.getIdUsuario()).orElseThrow().getPassword();
        assertTrue(encoder.matches("clave-antigua123", protegida));
        migracion.run(null);
        assertEquals(protegida, usuarios.findById(cliente.getIdUsuario()).orElseThrow().getPassword());
        assertEquals(200, pedir("POST", "login", null, Map.of("email", cliente.getEmail(), "password", "clave-antigua123")).statusCode());
    }
}
