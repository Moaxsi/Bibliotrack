package com.bibliotrack.ica.controller;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api")
public class DocumentoController {
    private final String token;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final JsonMapper mapper = JsonMapper.builder().build();

    public DocumentoController(@Value("${DECOLECTA_TOKEN:}") String token) {
        this.token = token.trim();
    }

    @PostMapping("/documento")
    public Map<String, String> consultar(@RequestBody Map<String, String> datos) {
        String tipo = datos.getOrDefault("tipo", "");
        String numero = datos.getOrDefault("numero", "");
        boolean dni = "dni".equals(tipo);
        if ((!dni && !"ruc".equals(tipo)) || numero == null || !numero.matches(dni ? "[0-9]{8}" : "[0-9]{11}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresa un documento válido.");
        }
        if (token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "La consulta de documentos no está disponible. Elige boleta simple o intenta más tarde.");
        }

        String ruta = dni ? "reniec/dni" : "sunat/ruc";
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.decolecta.com/v1/" + ruta + "?numero=" + numero))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/json")
                .GET().build();
        HttpResponse<String> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw errorProveedor();
        } catch (IOException ex) {
            throw errorProveedor();
        }
        if (response.statusCode() == 404) throw sinNombre();
        if (response.statusCode() != 200) throw errorProveedor();

        JsonNode datosProveedor;
        try {
            datosProveedor = mapper.readTree(response.body());
        } catch (RuntimeException ex) {
            throw errorProveedor();
        }
        if (datosProveedor == null || !datosProveedor.isObject()) throw errorProveedor();
        String nombre = campo(datosProveedor, dni ? "full_name" : "razon_social");
        if (nombre.isEmpty()) {
            nombre = dni
                    ? Stream.of("first_name", "first_last_name", "second_last_name")
                            .map(key -> campo(datosProveedor, key)).filter(valor -> !valor.isEmpty()).collect(Collectors.joining(" "))
                    : campo(datosProveedor, "nombre_o_razon_social");
        }
        if (nombre.isEmpty()) throw sinNombre();
        if (nombre.length() > 200) throw errorProveedor();
        return Map.of("nombre", nombre);
    }

    private static String campo(JsonNode datos, String key) {
        return datos.path(key).isString() ? datos.path(key).asString().trim() : "";
    }

    private static ResponseStatusException errorProveedor() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar el documento. Vuelve a intentarlo.");
    }

    private static ResponseStatusException sinNombre() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No encontramos un nombre para ese documento.");
    }
}
