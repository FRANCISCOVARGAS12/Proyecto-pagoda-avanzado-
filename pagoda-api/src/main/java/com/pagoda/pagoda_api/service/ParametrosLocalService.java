package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.ParametrosLocalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ParametrosLocalService {

    private final ParametrosLocalRepository parametrosLocalRepository;

    public ParametrosLocal obtener() {
        List<ParametrosLocal> todos = parametrosLocalRepository.findAll();
        if (todos.isEmpty()) {
            throw new PagodaException(ErrorCode.PARAMETROS_NO_CONFIGURADOS);
        }
        return todos.getFirst();
    }

    public ParametrosLocal guardar(ParametrosLocal payload) {
        ParametrosLocal actual;
        List<ParametrosLocal> todos = parametrosLocalRepository.findAll();
        if (todos.isEmpty()) {
            actual = payload;
        } else {
            actual = todos.getFirst();
            actual.setFondoLunes(payload.getFondoLunes());
            actual.setFondoMartes(payload.getFondoMartes());
            actual.setFondoMiercoles(payload.getFondoMiercoles());
            actual.setFondoJueves(payload.getFondoJueves());
            actual.setFondoViernes(payload.getFondoViernes());
            actual.setFondoSabado(payload.getFondoSabado());
            actual.setFondoDomingo(payload.getFondoDomingo());
            actual.setComisionBancaria(payload.getComisionBancaria());
            actual.setActualizadoPor(payload.getActualizadoPor());
        }
        actual.setFechaActualizacion(LocalDateTime.now());
        return parametrosLocalRepository.save(actual);
    }
}

