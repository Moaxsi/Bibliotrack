package com.bibliotrack.ica.controller;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ErroresApi {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> responder(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("error",
                exception.getReason() == null ? "No se pudo completar la operación" : exception.getReason()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> integridad() {
        return ResponseEntity.status(409).body(Map.of("error",
                "El registro está duplicado o tiene operaciones asociadas. Revisa los datos; puedes desactivarlo en lugar de eliminarlo."));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<?> formato() {
        return ResponseEntity.badRequest().body(Map.of("error", "Los datos enviados no tienen un formato válido"));
    }
}
