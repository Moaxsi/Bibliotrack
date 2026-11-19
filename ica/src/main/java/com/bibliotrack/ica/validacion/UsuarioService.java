package com.bibliotrack.ica.validacion;

import com.bibliotrack.ica.modelo.Usuario;
import com.bibliotrack.ica.modelo.Rol;
import com.bibliotrack.ica.repositorio.UsuarioRepository;
import com.bibliotrack.ica.repositorio.RolRepository;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UsuarioService {
    private final UsuarioRepository usuarios;
    private final RolRepository roles;
    private final PasswordEncoder passwords;

    public UsuarioService(UsuarioRepository usuarios, RolRepository roles, PasswordEncoder passwords) {
        this.usuarios = usuarios; this.roles = roles; this.passwords = passwords;
    }

    @Transactional
    public Usuario guardar(Integer id, Map<String, Object> datos, Integer actor, boolean registroPublico) {
        List<Usuario> bloqueados = id == null ? List.of() : usuarios.bloquearUsuarios();
        Usuario usuario = id == null ? new Usuario() : bloqueados.stream().filter(u -> u.getIdUsuario().equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        String nombre = Reglas.texto(datos, "nombre", 100);
        String email = Reglas.email(datos);
        usuarios.findByEmailIgnoreCase(email).filter(otro -> !otro.getIdUsuario().equals(id)).ifPresent(otro -> {
            throw Reglas.error("email: el correo ya se encuentra registrado");
        });
        Rol rol = registroPublico
                ? roles.findByNombreIgnoreCase("CLIENTE").orElseGet(() -> roles.save(new Rol(null, "CLIENTE")))
                : roles.findById(Reglas.entero(datos.get("idRol"), "idRol", 1)).orElseThrow(() -> Reglas.error("idRol: selecciona un rol válido"));
        if (!Set.of("ADMIN", "CLIENTE").contains(rol.getNombre().toUpperCase(Locale.ROOT))) throw Reglas.error("idRol: rol no permitido");
        String estado = registroPublico ? "Activo" : Reglas.texto(datos, "estado", 20);
        if (!Set.of("Activo", "Inactivo", "Suspendido").contains(estado)) throw Reglas.error("estado: selecciona un estado válido");
        if (id != null && id.equals(actor) && (!"ADMIN".equalsIgnoreCase(rol.getNombre()) || !"Activo".equals(estado))) {
            throw Reglas.error("No puedes quitar tu propio acceso de administrador");
        }
        boolean eraAdminActivo = id != null && "ADMIN".equalsIgnoreCase(usuario.getRol().getNombre()) && "Activo".equalsIgnoreCase(usuario.getEstado());
        if (eraAdminActivo && (!"ADMIN".equalsIgnoreCase(rol.getNombre()) || !"Activo".equals(estado))
                && bloqueados.stream().filter(u -> "ADMIN".equalsIgnoreCase(u.getRol().getNombre()) && "Activo".equalsIgnoreCase(u.getEstado())).count() <= 1) {
            throw Reglas.error("Debe permanecer al menos un administrador activo");
        }
        if (id == null || (datos.get("password") instanceof String p && !p.isEmpty())) {
            usuario.setPassword(passwords.encode(Reglas.password(datos.get("password"))));
        }
        usuario.setNombre(nombre); usuario.setEmail(email); usuario.setRol(rol); usuario.setEstado(estado);
        return usuarios.saveAndFlush(usuario);
    }

    public Map<String, Object> vista(Usuario usuario) {
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("idUsuario", usuario.getIdUsuario()); datos.put("nombre", usuario.getNombre());
        datos.put("email", usuario.getEmail()); datos.put("idRol", usuario.getRol().getIdRol());
        datos.put("rol", usuario.getRol().getNombre()); datos.put("estado", usuario.getEstado());
        datos.put("fechaCreacion", usuario.getFechaCreacion());
        return datos;
    }
}
