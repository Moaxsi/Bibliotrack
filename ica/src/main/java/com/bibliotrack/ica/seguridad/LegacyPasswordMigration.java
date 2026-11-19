package com.bibliotrack.ica.seguridad;

import com.bibliotrack.ica.repositorio.UsuarioRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class LegacyPasswordMigration implements ApplicationRunner {
    private static final Logger LOG = LoggerFactory.getLogger(LegacyPasswordMigration.class);
    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final boolean habilitada;

    public LegacyPasswordMigration(UsuarioRepository usuarios, PasswordEncoder encoder,
            @Value("${bibliotrack.security.migrate-legacy-passwords:true}") boolean habilitada) {
        this.usuarios = usuarios; this.encoder = encoder; this.habilitada = habilitada;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments argumentos) {
        if (!habilitada) return;
        int migradas = 0;
        for (var usuario : usuarios.bloquearUsuarios()) {
            String guardada = usuario.getPassword();
            if (guardada != null && !guardada.matches("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$")) {
                usuario.setPassword(encoder.encode(guardada));
                usuarios.save(usuario); migradas++;
            }
        }
        usuarios.flush();
        if (migradas > 0) LOG.info("Se protegieron {} contraseñas heredadas con BCrypt", migradas);
    }
}
