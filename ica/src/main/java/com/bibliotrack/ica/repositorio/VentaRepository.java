package com.bibliotrack.ica.repositorio;

import com.bibliotrack.ica.modelo.Venta;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VentaRepository extends JpaRepository<Venta, Integer> {
    List<Venta> findAllByOrderByIdVentaDesc();
    List<Venta> findByIdUsuarioOrderByIdVentaDesc(Integer idUsuario);
}
