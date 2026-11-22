package com.bibliotrack.ica.controller;

import com.bibliotrack.ica.modelo.Categoria;
import com.bibliotrack.ica.modelo.Contacto;
import com.bibliotrack.ica.modelo.DetalleVenta;
import com.bibliotrack.ica.modelo.Libro;
import com.bibliotrack.ica.modelo.Rol;
import com.bibliotrack.ica.modelo.Usuario;
import com.bibliotrack.ica.modelo.Venta;
import com.bibliotrack.ica.repositorio.CategoriaRepository;
import com.bibliotrack.ica.repositorio.ContactoRepository;
import com.bibliotrack.ica.repositorio.DetalleVentaRepository;
import com.bibliotrack.ica.repositorio.LibroRepository;
import com.bibliotrack.ica.repositorio.RolRepository;
import com.bibliotrack.ica.repositorio.UsuarioRepository;
import com.bibliotrack.ica.repositorio.VentaRepository;
import com.bibliotrack.ica.seguridad.JwtTokenService;
import com.bibliotrack.ica.validacion.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@RequestMapping("/api")
public class AppController {

    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private RolRepository rolRepository;
    @Autowired private CategoriaRepository categoriaRepository;
    @Autowired private LibroRepository libroRepository;
    @Autowired private VentaRepository ventaRepository;
    @Autowired private DetalleVentaRepository detalleVentaRepository;
    @Autowired private ContactoRepository contactoRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenService jwtTokenService;
    @Autowired private LibroService libroService;
    @Autowired private UsuarioService usuarioService;
    @Autowired private VentaService ventaService;
    @Value("${bibliotrack.uploads.directory:uploads}")
    private String uploadsDirectory;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        if (email == null || password == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Email y contraseña son obligatorios"));
        }

        Optional<Usuario> usuarioOpt = usuarioRepository.findByEmailIgnoreCase(email.trim());

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales incorrectas"));
        }

        Usuario usuario = usuarioOpt.get();
        if (!passwordEncoder.matches(password, usuario.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales incorrectas"));
        }

        if (!"Activo".equalsIgnoreCase(usuario.getEstado())) {
            return ResponseEntity.status(403).body(Map.of("error", "Usuario inactivo o suspendido"));
        }

        Map<String, Object> data = new HashMap<>();
        data.put("idUsuario", usuario.getIdUsuario());
        data.put("nombre", usuario.getNombre());
        data.put("email", usuario.getEmail());
        data.put("rol", usuario.getRol().getNombre().toUpperCase());
        data.put("token", jwtTokenService.generateToken(usuario));

        return ResponseEntity.ok(data);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> payload) {
        Usuario usuario = usuarioService.guardar(null, payload, null, true);
        return ResponseEntity.ok(Map.of("mensaje", "Usuario registrado exitosamente", "idUsuario", usuario.getIdUsuario()));
    }

    @GetMapping("/usuarios")
    public List<Map<String, Object>> usuarios() {
        return usuarioRepository.findAllByOrderByIdUsuarioDesc().stream().map(usuarioService::vista).toList();
    }

    @GetMapping("/roles")
    public List<Rol> roles() { return rolRepository.findAll(); }

    @PostMapping("/usuarios")
    public Map<String, Object> crearUsuario(@RequestBody Map<String, Object> datos, @AuthenticationPrincipal Jwt jwt) {
        return usuarioService.vista(usuarioService.guardar(null, datos, Integer.valueOf(jwt.getClaimAsString("idUsuario")), false));
    }

    @PutMapping("/usuarios/{id}")
    public Map<String, Object> actualizarUsuario(@PathVariable Integer id, @RequestBody Map<String, Object> datos, @AuthenticationPrincipal Jwt jwt) {
        return usuarioService.vista(usuarioService.guardar(id, datos, Integer.valueOf(jwt.getClaimAsString("idUsuario")), false));
    }

    @PostMapping(value = "/libros/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirImagenLibro(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "Selecciona una imagen válida de hasta 1 MB"));
        }

        String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        String extension = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        String contentType = file.getContentType();
        if (!Set.of("jpg", "jpeg", "png", "gif").contains(extension)
                || !Set.of("image/jpeg", "image/png", "image/gif").contains(contentType)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Formato no permitido. Usa JPG, PNG o GIF"));
        }

        try {
            try (var input = file.getInputStream()) {
                if (ImageIO.read(input) == null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "El archivo seleccionado no es una imagen válida"));
                }
            }

            Path directory = Paths.get(uploadsDirectory).toAbsolutePath().normalize();
            Files.createDirectories(directory);
            String filename = UUID.randomUUID() + "." + extension;
            file.transferTo(directory.resolve(filename));
            return ResponseEntity.ok(Map.of("urlPortada", "/uploads/" + filename));
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar la imagen", exception);
        }
    }

    @GetMapping("/categorias")
    public List<Categoria> getCategorias() {
        return categoriaRepository.findAll();
    }

    @GetMapping("/libros")
    public List<Libro> getLibros(
            @RequestParam(required = false) Integer categoria,
            @RequestParam(required = false) String buscar) {

        String termino = buscar == null ? "" : buscar.trim().toLowerCase(Locale.ROOT);
        String isbn = termino.replace("-", "").replace(" ", "");
        if (termino.length() > 200) throw Reglas.error("buscar: usa hasta 200 caracteres");
        return libroRepository.buscarCatalogo(categoria != null && categoria > 0 ? categoria : null, termino, isbn);
    }

    @GetMapping("/libros/{id}")
    public ResponseEntity<?> getLibroPorId(@PathVariable Integer id) {
        Optional<Libro> libroOpt = libroRepository.findById(id);
        if (libroOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Libro no encontrado"));
        }
        return ResponseEntity.ok(libroOpt.get());
    }

    @PostMapping("/libros")
    public Libro crearLibro(@RequestBody Map<String, Object> datos) { return libroService.guardar(null, datos); }

    @PutMapping("/libros/{id}")
    public Libro actualizarLibro(@PathVariable Integer id, @RequestBody Map<String, Object> datos) { return libroService.guardar(id, datos); }

    @PutMapping("/libros/{id}/estado")
    public Map<String, Object> cambiarEstadoLibro(@PathVariable Integer id, @RequestBody Map<String, Object> datos) {
        Libro libro = libroService.guardar(id, Map.of("estado", Reglas.texto(datos, "estado", 20)));
        return Map.of("mensaje", "Estado actualizado correctamente", "estado", libro.getEstado());
    }

    @DeleteMapping("/libros/{id}")
    public Map<String, String> eliminarLibro(@PathVariable Integer id) {
        libroService.eliminar(id);
        return Map.of("mensaje", "Libro eliminado correctamente");
    }

    @PostMapping("/ventas")
    public Map<String, Object> registrarVenta(@RequestBody Map<String, Object> datos, @AuthenticationPrincipal Jwt jwt) {
        return ventaService.registrar(datos, Integer.valueOf(jwt.getClaimAsString("idUsuario")), jwt.getClaimAsStringList("roles").contains("ADMIN"));
    }

    @GetMapping("/mis-compras")
    public List<Map<String, Object>> misCompras(@AuthenticationPrincipal Jwt jwt) {
        return ventaRepository.findByIdUsuarioOrderByIdVentaDesc(Integer.valueOf(jwt.getClaimAsString("idUsuario")))
                .stream().map(this::vistaVenta).toList();
    }

    @PatchMapping("/ventas/{idVenta}/estado")
    public Map<String, Object> cambiarEstadoVenta(@PathVariable Integer idVenta, @RequestBody Map<String, String> datos) {
        return ventaService.decidirYape(idVenta, datos.get("estado"));
    }

    private Map<String, Object> vistaVenta(Venta venta) {
        Map<String, Object> item = new HashMap<>();
        item.put("idVenta", venta.getIdVenta());
        item.put("idUsuario", venta.getIdUsuario());
        item.put("fecha", venta.getFecha());
        item.put("total", venta.getTotal());
        item.put("metodoPago", venta.getMetodoPago());
        item.put("tipoComprobante", venta.getTipoComprobante());
        item.put("estado", ventaService.estadoVisible(venta));
        if (venta.getVencePago() != null) item.put("vencePago", venta.getVencePago());
        return item;
    }

    @GetMapping("/mis-compras/{idVenta}/detalle")
    public List<Map<String, Object>> detallePropio(@PathVariable Integer idVenta, @AuthenticationPrincipal Jwt jwt) {
        Venta venta = ventaRepository.findById(idVenta)
                .filter(v -> v.getIdUsuario().equals(Integer.valueOf(jwt.getClaimAsString("idUsuario"))))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Compra no encontrada"));
        return verDetalleVenta(venta.getIdVenta());
    }

    @GetMapping("/ventas")
    public List<Map<String, Object>> listarVentasAdmin() {
        List<Venta> ventas = ventaRepository.findAllByOrderByIdVentaDesc();
        List<Map<String, Object>> respuesta = new ArrayList<>();

        for (Venta v : ventas) {
            Map<String, Object> item = vistaVenta(v);
            item.put("documentoComprobante", v.getDocumentoComprobante());
            item.put("nombreComprobante", v.getNombreComprobante());

            usuarioRepository.findById(v.getIdUsuario()).ifPresent(u -> {
                item.put("clienteNombre", u.getNombre());
                item.put("clienteEmail", u.getEmail());
            });

            respuesta.add(item);
        }
        return respuesta;
    }

    @GetMapping("/ventas/{idVenta}/detalle")
    public List<Map<String, Object>> verDetalleVenta(@PathVariable Integer idVenta) {
        List<DetalleVenta> detalles = detalleVentaRepository.findByIdVenta(idVenta);
        List<Map<String, Object>> resultado = new ArrayList<>();

        for (DetalleVenta d : detalles) {
            Map<String, Object> map = new HashMap<>();
            map.put("idDetalleVenta", d.getIdDetalleVenta());
            map.put("cantidad", d.getCantidad());
            map.put("precioUnitario", d.getPrecioUnitario());
            map.put("subtotal", d.getSubtotal());

            libroRepository.findById(d.getIdLibro()).ifPresent(l -> {
                map.put("tituloLibro", l.getTitulo());
                map.put("isbn", l.getIsbn());
                map.put("autor", l.getAutor());
                map.put("urlPortada", l.getUrlPortada());
            });

            resultado.add(map);
        }
        return resultado;
    }

    @PostMapping("/contacto")
    public ResponseEntity<?> registrarContacto(@RequestBody Map<String, String> payload) {
        String nombre = payload.get("nombre");
        String email = payload.get("email");
        String asunto = payload.get("asunto");
        String mensaje = payload.get("mensaje");

        if (nombre == null || email == null || asunto == null || mensaje == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Todos los campos son obligatorios"));
        }

        Contacto contacto = new Contacto();
        contacto.setNombre(nombre.trim());
        contacto.setEmail(email.trim());
        contacto.setAsunto(asunto.trim());
        contacto.setMensaje(mensaje.trim());

        contactoRepository.save(contacto);
        return ResponseEntity.ok(Map.of("mensaje", "Mensaje recibido correctamente. Te responderemos a la brevedad."));
    }
}
