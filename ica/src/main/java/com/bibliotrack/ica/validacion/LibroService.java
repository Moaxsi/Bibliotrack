package com.bibliotrack.ica.validacion;

import com.bibliotrack.ica.modelo.Libro;
import com.bibliotrack.ica.modelo.Venta;
import com.bibliotrack.ica.repositorio.CategoriaRepository;
import com.bibliotrack.ica.repositorio.LibroRepository;
import com.bibliotrack.ica.repositorio.DetalleVentaRepository;
import java.util.Map;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class LibroService {
    private final LibroRepository libros;
    private final CategoriaRepository categorias;
    private final DetalleVentaRepository detalles;

    public LibroService(LibroRepository libros, CategoriaRepository categorias, DetalleVentaRepository detalles) {
        this.libros = libros;
        this.categorias = categorias;
        this.detalles = detalles;
    }

    @Transactional
    public Libro guardar(Integer id, Map<String, Object> datos) {
        Libro libro = id == null ? new Libro() : existente(id);
        if (id == null || datos.containsKey("isbn")) {
            String isbn = Reglas.texto(datos, "isbn", 20).replace("-", "").replace(" ", "").toUpperCase(Locale.ROOT);
            if (!isbn.matches("(?:[0-9]{9}[0-9X]|[0-9]{13})")) throw Reglas.error("isbn: ingresa un ISBN de 10 o 13 caracteres");
            libros.buscarIsbnNormalizado(isbn).filter(otro -> !otro.getIdLibro().equals(id)).ifPresent(otro -> {
                throw Reglas.error("isbn: el código ISBN ya existe en el catálogo");
            });
            libro.setIsbn(isbn);
        }
        if (id == null || datos.containsKey("titulo")) libro.setTitulo(Reglas.texto(datos, "titulo", 200));
        if (id == null || datos.containsKey("autor")) libro.setAutor(Reglas.texto(datos, "autor", 150));
        if (id == null || datos.containsKey("precioVenta")) libro.setPrecioVenta(Reglas.dinero(datos.get("precioVenta"), "precioVenta", true));
        if (id == null || datos.containsKey("stock")) libro.setStock(Reglas.entero(datos.get("stock"), "stock", 0));
        if (id == null || datos.containsKey("idCategoria")) {
            int categoria = Reglas.entero(datos.get("idCategoria"), "idCategoria", 1);
            libro.setCategoria(categorias.findById(categoria).orElseThrow(() -> Reglas.error("idCategoria: selecciona una categoría válida")));
        }
        if (datos.containsKey("descripcion")) libro.setDescripcion(opcional(datos, "descripcion", 10000));
        if (datos.containsKey("urlPortada")) libro.setUrlPortada(opcional(datos, "urlPortada", 500));
        if (id == null || datos.containsKey("estado")) libro.setEstado(estado(datos.getOrDefault("estado", "Activo")));
        if (id != null && (datos.containsKey("stock") || datos.containsKey("estado"))) {
            long reservas = detalles.unidadesReservadas(id, Venta.horaLima().minusHours(24));
            if (reservas > 0 && (libro.getStock() < reservas || !"Activo".equals(libro.getEstado()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Hay " + reservas
                        + " unidades reservadas por Yape. Confirma o rechaza esos pedidos antes de cambiar la disponibilidad.");
            }
        }
        return libros.saveAndFlush(libro);
    }

    @Transactional
    public void eliminar(Integer id) {
        Libro libro = existente(id);
        if (detalles.existsByIdLibro(id)) throw new ResponseStatusException(HttpStatus.CONFLICT, "El libro tiene ventas registradas. Desactívalo para conservar el historial de compras.");
        libros.delete(libro); libros.flush();
    }

    private Libro existente(Integer id) {
        return libros.bloquearPorId(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Libro no encontrado"));
    }

    private String opcional(Map<String, Object> datos, String campo, int maximo) {
        Object valor = datos.get(campo);
        if (valor == null) return "";
        if (!(valor instanceof String texto) || texto.length() > maximo) throw Reglas.error(campo + ": el texto es demasiado largo");
        return texto.trim();
    }

    private String estado(Object valor) {
        if (!"Activo".equals(valor) && !"Inactivo".equals(valor)) throw Reglas.error("estado: selecciona Activo o Inactivo");
        return valor.toString();
    }
}
