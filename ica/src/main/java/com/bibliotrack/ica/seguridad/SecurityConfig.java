package com.bibliotrack.ica.seguridad;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.Customizer;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import com.bibliotrack.ica.repositorio.UsuarioRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecretKey jwtSecretKey(@Value("${bibliotrack.jwt.secret}") String secret) {
        byte[] key = secret.getBytes(StandardCharsets.UTF_8);
        if (key.length < 32) {
            throw new IllegalArgumentException("bibliotrack.jwt.secret must contain at least 32 UTF-8 bytes");
        }
        return new SecretKeySpec(key, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtSecretKey) {
        return NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter(UsuarioRepository usuarios) {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("roles");
            var usuario = usuarios.findByEmailIgnoreCase(jwt.getSubject());
            if (roles == null || usuario.isEmpty()
                    || !"Activo".equalsIgnoreCase(usuario.get().getEstado())
                    || !usuario.get().getIdUsuario().toString().equals(jwt.getClaimAsString("idUsuario"))
                    || !JwtTokenService.huellaCredencial(usuario.get().getPassword()).equals(jwt.getClaimAsString("credencial"))
                    || !roles.equals(List.of(usuario.get().getRol().getNombre().toUpperCase(Locale.ROOT)))) {
                throw new OAuth2AuthenticationException(new OAuth2Error("invalid_token"), "La cuenta o sus permisos cambiaron. Inicia sesión nuevamente.");
            }
            return roles.stream()
                    .filter(role -> role != null && !role.isBlank())
                    .<GrantedAuthority>map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT)))
                    .toList();
        });
        return converter;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationConverter jwtAuthenticationConverter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; "
                                + "script-src 'self' 'unsafe-inline'; "
                                + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                                + "font-src 'self' https://fonts.gstatic.com data:; "
                                + "img-src 'self' https: data:; connect-src 'self'; "
                                + "object-src 'none'; base-uri 'self'; "
                                + "frame-ancestors 'none'; form-action 'self'")))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/", "/index.html", "/frontend/**", "/*.html", "/favicon.ico").permitAll()
                        .requestMatchers("/api/login", "/api/register").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/categorias", "/api/libros", "/api/libros/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/contacto").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/ventas").hasAnyRole("CLIENTE", "ADMIN")
                        .requestMatchers("/api/mis-compras", "/api/mis-compras/**").hasAnyRole("CLIENTE", "ADMIN")
                        .requestMatchers("/api/usuarios", "/api/usuarios/**", "/api/roles").hasRole("ADMIN")
                        .requestMatchers("/api/ventas/**").hasRole("ADMIN")
                        .requestMatchers("/api/libros/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)));
        return http.build();
    }
}
