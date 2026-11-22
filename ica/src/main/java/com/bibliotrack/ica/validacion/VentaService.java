package com.bibliotrack.ica.validacion;

import com.bibliotrack.ica.modelo.*;
import com.bibliotrack.ica.repositorio.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VentaService {
    private final LibroRepository libros;
    private final UsuarioRepository usuarios;
    private final VentaRepository ventas;
    private final DetalleVentaRepository detalles;

    public VentaService(LibroRepository libros, UsuarioRepository usuarios, VentaRepository ventas, DetalleVentaRepository detalles) {
        this.libros = libros; this.usuarios = usuarios; this.ventas = ventas; this.detalles = detalles;
    }

    @Transactional
    public Map<String, Object> registrar(Map<String, Object> datos, Integer actor, boolean admin) {
        if (datos.containsKey("idCliente") && !admin) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo un administrador puede registrar ventas para otro cliente");
        int cliente = datos.containsKey("idCliente") ? Reglas.entero(datos.get("idCliente"), "idCliente", 1) : actor;
        Usuario usuario = usuarios.findById(cliente).orElseThrow(() -> Reglas.error("idCliente: cliente no encontrado"));
        if (!"Activo".equalsIgnoreCase(usuario.getEstado())) throw Reglas.error("idCliente: la cuenta no está activa");
        if (datos.containsKey("idCliente") && !"CLIENTE".equalsIgnoreCase(usuario.getRol().getNombre())) throw Reglas.error("idCliente: selecciona una cuenta de cliente");
        String pago = Reglas.texto(Map.of("metodoPago", Objects.toString(datos.getOrDefault("metodoPago", "Efectivo"), "")), "metodoPago", 50);
        String comprobante = Reglas.texto(Map.of("tipoComprobante", Objects.toString(datos.getOrDefault("tipoComprobante", "Boleta"), "")), "tipoComprobante", 50);
        if (!Set.of("Efectivo", "Tarjeta", "Yape", "Plin", "Transferencia").contains(pago)) throw Reglas.error("metodoPago: selecciona un método válido");
        if (!Set.of("Boleta", "Boleta de venta", "Factura").contains(comprobante)) throw Reglas.error("tipoComprobante: selecciona un comprobante válido");
        String documento = null;
        String nombre = null;
        if ("Boleta de venta".equals(comprobante) || "Factura".equals(comprobante) && (!admin || datos.containsKey("documentoComprobante"))) {
            documento = Reglas.texto(datos, "documentoComprobante", 11);
            if (!documento.matches("Factura".equals(comprobante) ? "[0-9]{11}" : "[0-9]{8}")) throw Reglas.error("Ingresa un documento válido.");
            nombre = Reglas.texto(datos, "nombreComprobante", 200);
        }
        boolean pendiente = "Yape".equals(pago) && !datos.containsKey("idCliente");
        if (!(datos.get("items") instanceof List<?> items) || items.isEmpty() || items.size() > 200) throw Reglas.error("Selecciona entre 1 y 200 libros para la compra");
        Map<Integer, Integer> cantidades = new TreeMap<>();
        for (Object elemento : items) {
            if (!(elemento instanceof Map<?, ?> item)) throw Reglas.error("El detalle de compra no es válido");
            int id = Reglas.entero(item.get("idLibro"), "idLibro", 1);
            int cantidad = Reglas.entero(item.get("cantidad"), "cantidad", 1);
            try { cantidades.merge(id, cantidad, Math::addExact); }
            catch (ArithmeticException exception) { throw Reglas.error("cantidad: el total solicitado es demasiado grande"); }
        }
        Map<Integer, Libro> seleccionados = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (var item : cantidades.entrySet()) {
            Libro libro = libros.bloquearPorId(item.getKey()).orElseThrow(() -> Reglas.error("Uno de los libros ya no existe"));
            if (!"Activo".equalsIgnoreCase(libro.getEstado())) throw Reglas.error("El libro '" + libro.getTitulo() + "' ya no está disponible");
            long disponible = Math.max(0, libro.getStock() - detalles.unidadesReservadas(libro.getIdLibro(), Venta.horaLima().minusHours(24)));
            if (disponible < item.getValue()) throw Reglas.error("Stock insuficiente para '" + libro.getTitulo() + "'. Disponible: " + disponible);
            BigDecimal precio = Reglas.dinero(libro.getPrecioVenta(), "precioVenta", true);
            total = total.add(precio.multiply(BigDecimal.valueOf(item.getValue())));
            seleccionados.put(item.getKey(), libro);
        }
        total = Reglas.dinero(total, "total", true);
        Venta venta = new Venta(); venta.setIdUsuario(cliente); venta.setMetodoPago(pago);
        venta.setTipoComprobante(comprobante);
        venta.setDocumentoComprobante(documento);
        venta.setNombreComprobante(nombre);
        venta.setTotal(total);
        venta.setEstado(pendiente ? "Pendiente" : "Completada");
        ventas.saveAndFlush(venta);
        for (var item : cantidades.entrySet()) {
            Libro libro = seleccionados.get(item.getKey());
            DetalleVenta detalle = new DetalleVenta(); detalle.setIdVenta(venta.getIdVenta()); detalle.setIdLibro(libro.getIdLibro());
            detalle.setCantidad(item.getValue()); detalle.setPrecioUnitario(libro.getPrecioVenta());
            detalle.setSubtotal(libro.getPrecioVenta().multiply(BigDecimal.valueOf(item.getValue())));
            detalles.save(detalle);
            if (!pendiente) {
                libro.setStock(libro.getStock() - item.getValue());
                libros.save(libro);
            }
        }
        detalles.flush(); libros.flush();
        Map<String, Object> resultado = new HashMap<>(Map.of("success", true, "idVenta", venta.getIdVenta(),
                "total", total, "estado", venta.getEstado(), "mensaje", pendiente ? "Compra pendiente de confirmación" : "Compra registrada con éxito"));
        if (pendiente) resultado.put("vencePago", venta.getVencePago());
        return resultado;
    }

    public String estadoVisible(Venta venta) {
        var vencimiento = venta.getVencePago();
        return vencimiento != null && !Venta.horaLima().isBefore(vencimiento) ? "Vencida" : venta.getEstado();
    }

    @Transactional
    public Map<String, Object> decidirYape(Integer id, String estado) {
        if (!List.of("Confirmada", "Rechazada").contains(Objects.toString(estado, ""))) {
            throw Reglas.error("Selecciona un estado válido.");
        }
        Venta venta = ventas.bloquearPorId(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Compra no encontrada"));
        if (!"Yape".equals(venta.getMetodoPago())) throw conflicto("Solo se pueden revisar compras por Yape.");
        if (estado.equals(venta.getEstado())) return Map.of("idVenta", id, "estado", estado);
        if (!"Pendiente".equals(venta.getEstado())) throw conflicto("Esta compra ya fue revisada.");
        if ("Vencida".equals(estadoVisible(venta))) throw conflicto("El plazo de 24 horas de esta compra venció.");

        if ("Confirmada".equals(estado)) {
            var items = detalles.findByIdVenta(id).stream().sorted(Comparator.comparing(DetalleVenta::getIdLibro)).toList();
            if (items.isEmpty()) throw conflicto("La compra no tiene libros registrados.");
            for (var item : items) {
                Libro libro = libros.bloquearPorId(item.getIdLibro()).orElseThrow(() -> conflicto("Un libro de la compra ya no está disponible."));
                if (!"Activo".equals(libro.getEstado()) || libro.getStock() < item.getCantidad()) {
                    throw conflicto("«" + libro.getTitulo() + "» ya no tiene disponibilidad suficiente. Revisa el inventario o rechaza la compra.");
                }
                libro.setStock(libro.getStock() - item.getCantidad());
            }
        }
        if ("Vencida".equals(estadoVisible(venta))) throw conflicto("El plazo de 24 horas de esta compra venció.");
        venta.setEstado(estado);
        return Map.of("idVenta", id, "estado", estado);
    }

    private ResponseStatusException conflicto(String mensaje) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensaje);
    }
}
