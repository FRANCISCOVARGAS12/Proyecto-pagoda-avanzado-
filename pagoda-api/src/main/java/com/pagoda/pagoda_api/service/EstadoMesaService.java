package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.EstadoMesa;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.EstadoMesaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EstadoMesaService {

    private final EstadoMesaRepository estadoMesaRepository;

    public List<EstadoMesa> listar() {
        return estadoMesaRepository.findAll();
    }

    public EstadoMesa obtenerPorId(Integer id) {
        return estadoMesaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.ESTADO_MESA_NO_ENCONTRADO));
    }

    public EstadoMesa crear(EstadoMesa estadoMesa) {
        if (estadoMesaRepository.existsByNombre(estadoMesa.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_ESTADO_MESA_DUPLICADO);
        }
        return estadoMesaRepository.save(estadoMesa);
    }

    public EstadoMesa actualizar(Integer id, EstadoMesa payload) {
        EstadoMesa actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && estadoMesaRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_ESTADO_MESA_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        return estadoMesaRepository.save(actual);
    }

    public void eliminar(Integer id) {
        EstadoMesa estadoMesa = obtenerPorId(id);
        estadoMesaRepository.delete(estadoMesa);
    }
}

