package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.dto.response.LoginResponse;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.catalogos.Rol;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.RolRepository;
import com.pagoda.pagoda_api.repository.operacion.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PasswordEncoder passwordEncoder;
    private final JornadaService jornadaService;
    private final ConcurrentHashMap<String, TokenSession> tokenSessions = new ConcurrentHashMap<>();

    private static final long TOKEN_HOURS = 12;

    public LoginResponse loginConPin(String nombre, String pin) {
        Usuario usuario = usuarioRepository.findTopByNombreIgnoreCaseAndActivoTrueOrderByIdDesc(nombre)
                .orElseThrow(() -> new PagodaException(ErrorCode.PIN_INCORRECTO));

        if (!passwordEncoder.matches(pin, usuario.getPinHash())) {
            throw new PagodaException(ErrorCode.PIN_INCORRECTO);
        }

        return crearSesion(usuario);
    }

    public LoginResponse loginMeseroConPin(String pin) {
        Rol meseroRol = rolRepository.findByNombre("MESERO")
                .orElseThrow(() -> new PagodaException(ErrorCode.ROL_NO_ENCONTRADO));

        List<Usuario> meserosActivos = usuarioRepository.findByRolIdAndActivoTrueOrderByIdDesc(meseroRol.getId());
        List<Usuario> coincidencias = meserosActivos.stream()
                .filter(candidato -> passwordEncoder.matches(pin, candidato.getPinHash()))
                .toList();
        if (coincidencias.isEmpty()) {
            throw new PagodaException(ErrorCode.PIN_INCORRECTO);
        }
        if (coincidencias.size() > 1) {
            throw new PagodaException(ErrorCode.PIN_DUPLICADO);
        }
        Usuario usuario = coincidencias.getFirst();

        Jornada jornadaActiva = jornadaService.asegurarJornadaActiva(usuario);
        if (jornadaActiva == null) {
            throw new PagodaException(ErrorCode.ERROR_INTERNO);
        }

        return crearSesion(usuario);
    }

    public Optional<Usuario> obtenerUsuarioPorToken(String token) {
        TokenSession session = tokenSessions.get(token);
        if (session == null) {
            return Optional.empty();
        }

        if (Instant.now().isAfter(session.expiresAt())) {
            tokenSessions.remove(token);
            return Optional.empty();
        }

        return usuarioRepository.findById(session.userId())
                .filter(Usuario::getActivo);
    }

    public Usuario obtenerAdminPorToken(String token) {
        Usuario usuario = obtenerUsuarioPorToken(token)
                .orElseThrow(() -> new PagodaException(ErrorCode.USUARIO_NO_ENCONTRADO));

        Rol adminRol = rolRepository.findByNombre("ADMIN")
                .orElseThrow(() -> new PagodaException(ErrorCode.ROL_NO_ENCONTRADO));

        if (usuario.getRol() == null || !adminRol.getId().equals(usuario.getRol().getId())) {
            throw new PagodaException(ErrorCode.TOKEN_INVALIDO);
        }

        return usuario;
    }

    private record TokenSession(Integer userId, Instant expiresAt) {
    }

    private LoginResponse crearSesion(Usuario usuario) {
        String token = UUID.randomUUID().toString();
        tokenSessions.put(token, new TokenSession(usuario.getId(), Instant.now().plus(TOKEN_HOURS, ChronoUnit.HOURS)));

        return LoginResponse.builder()
                .usuarioId(usuario.getId())
                .nombre(usuario.getNombre())
                .rol(usuario.getRol() == null ? null : usuario.getRol().getNombre())
                .token(token)
                .build();
    }
}
