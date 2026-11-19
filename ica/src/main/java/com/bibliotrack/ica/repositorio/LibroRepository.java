package com.bibliotrack.ica.repositorio;

import com.bibliotrack.ica.modelo.Libro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface LibroRepository extends JpaRepository<Libro, Integer> {
    @Query("select l from Libro l where (:categoria is null or l.categoria.idCategoria = :categoria) and "
            + "(:buscar = '' or lower(l.titulo) like concat('%', :buscar, '%') or lower(l.autor) like concat('%', :buscar, '%') "
            + "or lower(replace(replace(l.isbn, '-', ''), ' ', '')) like concat('%', :isbn, '%')) order by l.idLibro desc")
    List<Libro> buscarCatalogo(@Param("categoria") Integer categoria, @Param("buscar") String buscar, @Param("isbn") String isbn);
    Optional<Libro> findByIsbn(String isbn);
    @Query("select l from Libro l where upper(replace(replace(l.isbn, '-', ''), ' ', '')) = :isbn")
    Optional<Libro> buscarIsbnNormalizado(@Param("isbn") String isbn);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Libro l where l.idLibro = :id")
    Optional<Libro> bloquearPorId(@Param("id") Integer id);
    List<Libro> findAllByOrderByIdLibroDesc();
    List<Libro> findByCategoriaIdCategoriaOrderByIdLibroDesc(Integer idCategoria);
    List<Libro> findByTituloContainingIgnoreCaseOrAutorContainingIgnoreCase(String titulo, String autor);
}
