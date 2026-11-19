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
        if (!Set.of("Boleta", "Factura").contains(comprobante)) throw Reglas.error("tipoComprobante: selecciona un comprobante válido");
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
            if (libro.getStock() < item.getValue()) throw Reglas.error("Stock insuficiente para '" + libro.getTitulo() + "'. Disponible: " + libro.getStock());
            BigDecimal precio = Reglas.dinero(libro.getPrecioVenta(), "precioVenta", true);
            total = total.add(precio.multiply(BigDecimal.valueOf(item.getValue())));
            seleccionados.put(item.getKey(), libro);
        }
        total = Reglas.dinero(total, "total", true);
        Venta venta = new Venta(); venta.setIdUsuario(cliente); venta.setMetodoPago(pago);
        venta.setTipoComprobante(comprobante); venta.setTotal(total); venta.setEstado("Completada");
        ventas.saveAndFlush(venta);
        for (var item : cantidades.entrySet()) {
            Libro libro = seleccionados.get(item.getKey());
            DetalleVenta detalle = new DetalleVenta(); detalle.setIdVenta(venta.getIdVenta()); detalle.setIdLibro(libro.getIdLibro());
            detalle.setCantidad(item.getValue()); detalle.setPrecioUnitario(libro.getPrecioVenta());
            detalle.setSubtotal(libro.getPrecioVenta().multiply(BigDecimal.valueOf(item.getValue())));
            detalles.save(detalle); libro.setStock(libro.getStock() - item.getValue()); libros.save(libro);
        }
        detalles.flush(); libros.flush();
        return Map.of("success", true, "mensaje", "Compra registrada con éxito", "idVenta", venta.getIdVenta(), "total", total);
    }
}
