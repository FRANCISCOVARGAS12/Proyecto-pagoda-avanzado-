package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.Rol;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private static final String ADMIN_ROLE = "ADMIN";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public List<Usuario> obtenerTodos() {
        return usuarioRepository.findAll();
    }

    public Usuario obtenerPorId(Integer id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.USUARIO_NO_ENCONTRADO));
    }

    public Usuario guardar(Usuario usuario) {
        String nombreNormalizado = normalizarNombre(usuario.getNombre());
        validarNombreDisponible(nombreNormalizado, null);
        usuario.setNombre(nombreNormalizado);
        return usuarioRepository.save(usuario);
    }

    public Usuario actualizar(Integer id, Usuario payload, Integer currentAdminId) {
        Usuario actual = obtenerPorId(id);
        String nombreNormalizado = normalizarNombre(payload.getNombre());
        validarNombreDisponible(nombreNormalizado, id);

        boolean estabaActivo = Boolean.TRUE.equals(actual.getActivo());
        boolean quedaraActivo = Boolean.TRUE.equals(payload.getActivo());
        if (estabaActivo && !quedaraActivo) {
            validarDesactivacion(actual, currentAdminId);
        }
        if (!estabaActivo && quedaraActivo && payload.getPinHash() == null) {
            throw new PagodaException(ErrorCode.PIN_REACTIVACION_REQUERIDO);
        }

        actual.setNombre(nombreNormalizado);
        actual.setRol(payload.getRol());
        if (payload.getPinHash() != null) {
            actual.setPinHash(payload.getPinHash());
        }
        if (payload.getActivo() != null) {
            actual.setActivo(payload.getActivo());
        }
        return usuarioRepository.save(actual);
    }

    public void desactivar(Integer id, Integer currentAdminId) {
        Usuario usuario = obtenerPorId(id);
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            return;
        }
        validarDesactivacion(usuario, currentAdminId);
        usuario.setActivo(false);
        usuarioRepository.save(usuario);
    }

    public void eliminar(Integer id) {
        Usuario usuario = obtenerPorId(id);
        usuarioRepository.delete(usuario);
    }

    public void validarPinUnicoEntreUsuariosActivos(String pinPlano, Integer usuarioExcluirId) {
        if (pinPlano == null || pinPlano.isBlank()) {
            return;
        }
        List<Usuario> usuariosActivos = usuarioRepository.findByActivoTrue();
        boolean pinDuplicado = usuariosActivos.stream()
                .filter(u -> usuarioExcluirId == null || !u.getId().equals(usuarioExcluirId))
                .anyMatch(u -> passwordEncoder.matches(pinPlano, u.getPinHash()));
        if (pinDuplicado) {
            throw new PagodaException(ErrorCode.PIN_DUPLICADO);
        }
    }

    public Usuario guardarPrimerAdmin(String nombre, Rol adminRol, String pinPlano) {
        if (existeAdminActivo()) {
            throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
        }

        String nombreNormalizado = normalizarNombre(nombre);
        Usuario existente = usuarioRepository.findAll().stream()
                .filter(usuario -> normalizarNombre(usuario.getNombre()).equalsIgnoreCase(nombreNormalizado))
                .findFirst()
                .orElse(null);

        validarPinUnicoEntreUsuariosActivos(pinPlano, existente == null ? null : existente.getId());
        if (existente != null) {
            if (Boolean.TRUE.equals(existente.getActivo())) {
                throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
            }
            existente.setNombre(nombreNormalizado);
            existente.setRol(adminRol);
            existente.setPinHash(passwordEncoder.encode(pinPlano));
            existente.setActivo(true);
            return usuarioRepository.save(existente);
        }

        Usuario admin = Usuario.builder()
                .nombre(nombreNormalizado)
                .rol(adminRol)
                .pinHash(passwordEncoder.encode(pinPlano))
                .activo(true)
                .build();
        return usuarioRepository.save(admin);
    }

    private void validarNombreDisponible(String nombreNormalizado, Integer usuarioExcluirId) {
        usuarioRepository.findAll().stream()
                .filter(usuario -> usuarioExcluirId == null || !usuario.getId().equals(usuarioExcluirId))
                .filter(usuario -> normalizarNombre(usuario.getNombre()).equalsIgnoreCase(nombreNormalizado))
                .findFirst()
                .ifPresent(usuario -> {
                    if (Boolean.TRUE.equals(usuario.getActivo())) {
                        throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
                    }
                    throw new PagodaException(ErrorCode.NOMBRE_USUARIO_INACTIVO_DUPLICADO);
                });
    }

    private void validarDesactivacion(Usuario usuario, Integer currentAdminId) {
        if (usuario.getId().equals(currentAdminId)) {
            throw new PagodaException(ErrorCode.USUARIO_ACTUAL_NO_DESACTIVABLE);
        }
        if (esAdmin(usuario) && contarAdminsActivos() <= 1) {
            throw new PagodaException(ErrorCode.ULTIMO_ADMIN_ACTIVO);
        }
    }

    private boolean existeAdminActivo() {
        return contarAdminsActivos() > 0;
    }

    private long contarAdminsActivos() {
        return usuarioRepository.findAll().stream()
                .filter(usuario -> Boolean.TRUE.equals(usuario.getActivo()))
                .filter(this::esAdmin)
                .count();
    }

    private boolean esAdmin(Usuario usuario) {
        return usuario.getRol() != null && ADMIN_ROLE.equalsIgnoreCase(usuario.getRol().getNombre());
    }

    private String normalizarNombre(String nombre) {
        return (nombre == null ? "" : nombre.trim()).replaceAll("\\s+", " ");
    }
}
