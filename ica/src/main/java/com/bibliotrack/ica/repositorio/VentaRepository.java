package com.bibliotrack.ica.repositorio;

import com.bibliotrack.ica.modelo.Venta;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VentaRepository extends JpaRepository<Venta, Integer> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM Venta v WHERE v.idVenta = :id")
    Optional<Venta> bloquearPorId(@Param("id") Integer id);

    List<Venta> findAllByOrderByIdVentaDesc();
    List<Venta> findByIdUsuarioOrderByIdVentaDesc(Integer idUsuario);
}
