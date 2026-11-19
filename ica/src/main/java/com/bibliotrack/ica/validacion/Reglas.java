package com.bibliotrack.ica.validacion;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class Reglas {
    private Reglas() {}

    public static ResponseStatusException error(String mensaje) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }

    public static String texto(Map<String, ?> datos, String campo, int maximo) {
        Object valor = datos.get(campo);
        if (!(valor instanceof String cadena) || cadena.isBlank() || cadena.trim().length() > maximo) {
            throw error(campo + ": ingresa un valor de hasta " + maximo + " caracteres");
        }
        return cadena.trim();
    }

    public static int entero(Object valor, String campo, int minimo) {
        try {
            int numero = new BigDecimal(String.valueOf(valor)).intValueExact();
            if (numero < minimo) throw new ArithmeticException();
            return numero;
        } catch (NumberFormatException | ArithmeticException exception) {
            throw error(campo + ": ingresa un número entero mayor o igual a " + minimo);
        }
    }

    public static BigDecimal dinero(Object valor, String campo, boolean positivo) {
        try {
            BigDecimal numero = new BigDecimal(String.valueOf(valor)).setScale(2, RoundingMode.UNNECESSARY);
            if (numero.signum() < (positivo ? 1 : 0) || numero.compareTo(new BigDecimal("99999999.99")) > 0) {
                throw new ArithmeticException();
            }
            return numero;
        } catch (NumberFormatException | ArithmeticException exception) {
            throw error(campo + ": ingresa un importe " + (positivo ? "positivo" : "no negativo") + " con hasta dos decimales");
        }
    }

    public static String email(Map<String, ?> datos) {
        String email = texto(datos, "email", 150).toLowerCase(java.util.Locale.ROOT);
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw error("email: ingresa un correo válido");
        return email;
    }

    public static String password(Object valor) {
        if (!(valor instanceof String password) || password.isBlank() || password.length() < 6
                || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw error("password: usa al menos 6 caracteres y como máximo 72 bytes");
        }
        return password;
    }
}
