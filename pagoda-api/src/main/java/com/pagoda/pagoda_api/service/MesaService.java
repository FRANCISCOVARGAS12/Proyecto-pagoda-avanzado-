package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Mesa;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.MesaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MesaService {

    private final MesaRepository mesaRepository;

    public List<Mesa> obtenerTodas() {
        return mesaRepository.findAll();
    }

    public List<Mesa> obtenerLibres() {
        return mesaRepository.findByEstadoNombre("LIBRE");
    }

    public Mesa obtenerPorId(Integer id) {
        return mesaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.MESA_NO_ENCONTRADA));
    }

    public Mesa guardar(Mesa mesa) {
        if (mesa.getId() == null && mesaRepository.existsByNumero(mesa.getNumero())) {
            throw new PagodaException(ErrorCode.NUMERO_MESA_DUPLICADO);
        }
        return mesaRepository.save(mesa);
    }

    public Mesa actualizar(Integer id, Mesa payload) {
        Mesa actual = obtenerPorId(id);
        if (!actual.getNumero().equals(payload.getNumero()) && mesaRepository.existsByNumero(payload.getNumero())) {
            throw new PagodaException(ErrorCode.NUMERO_MESA_DUPLICADO);
        }
        actual.setNumero(payload.getNumero());
        actual.setCapacidad(payload.getCapacidad());
        actual.setEstado(payload.getEstado());
        return mesaRepository.save(actual);
    }

    public void eliminar(Integer id) {
        Mesa mesa = obtenerPorId(id);
        mesaRepository.delete(mesa);
    }
}