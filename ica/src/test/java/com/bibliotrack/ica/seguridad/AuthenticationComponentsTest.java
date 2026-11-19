package com.bibliotrack.ica.seguridad;

import com.bibliotrack.ica.modelo.Rol;
import com.bibliotrack.ica.modelo.Usuario;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class AuthenticationComponentsTest {

    @Test
    void bcryptHashCanBeMatchedWithoutStoringTheOriginalPassword() {
        BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
        String password = "prueba-segura";

        String hash = passwordEncoder.encode(password);

        assertNotEquals(password, hash);
        assertTrue(hash.matches("\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}"));
        assertTrue(passwordEncoder.matches(password, hash));
        assertFalse(passwordEncoder.matches("incorrecta", hash));
    }

    @Test
    void jwtCarriesIdentityAndRoleAndRejectsTampering() {
        SecretKey secretKey = new SecretKeySpec(
                "test-only-secret-with-more-than-32-bytes".getBytes(StandardCharsets.UTF_8),
                "HmacSHA256");
        JwtTokenService tokenService = new JwtTokenService(
                new NimbusJwtEncoder(new ImmutableSecret<>(secretKey)));
        JwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        Rol role = new Rol();
        role.setNombre("CLIENTE");
        Usuario user = new Usuario();
        user.setIdUsuario(42);
        user.setEmail("cliente@example.com");
        user.setRol(role);
        String token = tokenService.generateToken(user);

        var decoded = decoder.decode(token);
        assertEquals("cliente@example.com", decoded.getSubject());
        assertEquals("42", decoded.getClaimAsString("idUsuario"));
        assertEquals("CLIENTE", decoded.getClaimAsStringList("roles").getFirst());
        assertTrue(decoded.getExpiresAt().isAfter(decoded.getIssuedAt()));

        int signatureStart = token.lastIndexOf('.') + 1;
        char replacement = token.charAt(signatureStart) == 'A' ? 'B' : 'A';
        String tampered = token.substring(0, signatureStart) + replacement + token.substring(signatureStart + 1);
        assertThrows(JwtException.class, () -> decoder.decode(tampered));
    }
}
