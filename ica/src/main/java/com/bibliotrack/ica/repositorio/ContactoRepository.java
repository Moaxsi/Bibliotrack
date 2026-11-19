package com.bibliotrack.ica.repositorio;

import com.bibliotrack.ica.modelo.Contacto;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactoRepository extends JpaRepository<Contacto, Integer> {
}
