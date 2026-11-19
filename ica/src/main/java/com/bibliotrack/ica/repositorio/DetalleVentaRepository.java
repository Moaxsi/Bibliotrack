package com.bibliotrack.ica.repositorio;

import com.bibliotrack.ica.modelo.DetalleVenta;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DetalleVentaRepository extends JpaRepository<DetalleVenta, Integer> {
    List<DetalleVenta> findByIdVenta(Integer idVenta);
    boolean existsByIdLibro(Integer idLibro);
}
