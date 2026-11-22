package com.bibliotrack.ica.repositorio;

import com.bibliotrack.ica.modelo.DetalleVenta;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DetalleVentaRepository extends JpaRepository<DetalleVenta, Integer> {
    List<DetalleVenta> findByIdVenta(Integer idVenta);
    @Query("""
            SELECT COALESCE(SUM(d.cantidad), 0) FROM DetalleVenta d, Venta v
            WHERE d.idVenta = v.idVenta AND d.idLibro = :id
              AND v.metodoPago = 'Yape' AND v.estado = 'Pendiente' AND v.fecha > :desde
            """)
    long unidadesReservadas(@Param("id") Integer id, @Param("desde") LocalDateTime desde);

    boolean existsByIdLibro(Integer idLibro);
}
