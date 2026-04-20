package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    public List<Usuario> obtenerTodos() {
        return usuarioRepository.findAll();
    }

    public Usuario obtenerPorId(Integer id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.USUARIO_NO_ENCONTRADO));
    }

    public Usuario guardar(Usuario usuario) {
        if (usuario.getId() == null && usuarioRepository.existsByNombre(usuario.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
        }
        return usuarioRepository.save(usuario);
    }

    public Usuario actualizar(Integer id, Usuario payload) {
        Usuario actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && usuarioRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        actual.setRol(payload.getRol());
        if (payload.getPinHash() != null) {
            actual.setPinHash(payload.getPinHash());
        }
        if (payload.getActivo() != null) {
            actual.setActivo(payload.getActivo());
        }
        return usuarioRepository.save(actual);
    }

    public void desactivar(Integer id) {
        Usuario usuario = obtenerPorId(id);
        usuario.setActivo(false);
        usuarioRepository.save(usuario);
    }

    public void eliminar(Integer id) {
        Usuario usuario = obtenerPorId(id);
        usuarioRepository.delete(usuario);
    }
}