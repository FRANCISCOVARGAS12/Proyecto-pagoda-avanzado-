package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.Rol;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.RolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RolService {

    private final RolRepository rolRepository;

    public List<Rol> listar() {
        return rolRepository.findAll();
    }

    public Rol obtenerPorId(Integer id) {
        return rolRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.ROL_NO_ENCONTRADO));
    }

    public Rol crear(Rol rol) {
        if (rolRepository.existsByNombre(rol.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_ROL_DUPLICADO);
        }
        return rolRepository.save(rol);
    }

    public Rol actualizar(Integer id, Rol payload) {
        Rol actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && rolRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_ROL_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        actual.setDescripcion(payload.getDescripcion());
        return rolRepository.save(actual);
    }

    public void eliminar(Integer id) {
        Rol rol = obtenerPorId(id);
        rolRepository.delete(rol);
    }
}

