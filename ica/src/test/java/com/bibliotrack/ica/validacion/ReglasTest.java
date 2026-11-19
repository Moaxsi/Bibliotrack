package com.bibliotrack.ica.validacion;

import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ReglasTest {

    @Test
    void passwordRechazaVaciasCortasYMasDe72Bytes() {
        assertEquals("clave123", Reglas.password("clave123"));
        for (String invalida : new String[]{"", "     ", "12345", "á".repeat(37)}) {
            rechaza400(() -> Reglas.password(invalida));
        }
        assertEquals("á".repeat(36), Reglas.password("á".repeat(36)));
    }

    @Test
    void enteroRechazaCantidadesNegativasFraccionesYDesbordamiento() {
        assertEquals(1, Reglas.entero(1, "cantidad", 1));
        for (Object invalido : new Object[]{0, -1, 1.5, "abc", 2147483648L}) {
            rechaza400(() -> Reglas.entero(invalido, "cantidad", 1));
        }
    }

    @Test
    void dineroRechazaImportesNegativosYPrecisionExcesiva() {
        assertEquals(new BigDecimal("25.50"), Reglas.dinero("25.50", "precio", true));
        for (Object invalido : new Object[]{0, -1, "25.501", "100000000", "abc"}) {
            rechaza400(() -> Reglas.dinero(invalido, "precio", true));
        }
    }

    @Test
    void emailNormalizaYRechazaFormatoInvalido() {
        assertEquals("cliente@example.com", Reglas.email(Map.of("email", " Cliente@Example.com ")));
        for (String invalido : new String[]{"sin-arroba", "a@b", "a b@example.com"}) {
            rechaza400(() -> Reglas.email(Map.of("email", invalido)));
        }
    }

    @Test
    void textoRechazaAusenciaBlancosYLongitudExcesiva() {
        assertEquals("Libro", Reglas.texto(Map.of("titulo", " Libro "), "titulo", 5));
        rechaza400(() -> Reglas.texto(Map.of(), "titulo", 5));
        rechaza400(() -> Reglas.texto(Map.of("titulo", " "), "titulo", 5));
        rechaza400(() -> Reglas.texto(Map.of("titulo", "123456"), "titulo", 5));
    }

    @Test
    void stockAdmiteCeroPeroPrecioPositivoLoRechaza() {
        assertEquals(0, Reglas.entero(0, "stock", 0));
        assertEquals(new BigDecimal("0.00"), Reglas.dinero(0, "importe", false));
        rechaza400(() -> Reglas.dinero(0, "precioVenta", true));
    }

    private void rechaza400(org.junit.jupiter.api.function.Executable operacion) {
        var error = assertThrows(ResponseStatusException.class, operacion);
        assertEquals(400, error.getStatusCode().value());
    }
}
