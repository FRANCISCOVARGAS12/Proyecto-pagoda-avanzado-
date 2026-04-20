package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.JornadaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class JornadaService {

    private static final String ESTADO_ABIERTA = "ABIERTA";
    private static final String ESTADO_CERRADA = "CERRADA";

    private final JornadaRepository jornadaRepository;

    public List<Jornada> listarTodas() {
        return jornadaRepository.findAll();
    }

    public Optional<Jornada> obtenerJornadaAbierta() {
        return jornadaRepository.findByEstadoIgnoreCase(ESTADO_ABIERTA);
    }

    public Jornada obtenerPorId(Integer id) {
        return jornadaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.JORNADA_NO_ENCONTRADA));
    }

    public Jornada abrirJornada(Jornada jornada) {
        if (obtenerJornadaAbierta().isPresent()) {
            throw new PagodaException(ErrorCode.JORNADA_ABIERTA);
        }
        jornada.setFecha(jornada.getFecha() == null ? LocalDate.now() : jornada.getFecha());
        jornada.setHoraApertura(LocalDateTime.now());
        jornada.setHoraCierre(null);
        jornada.setEstado(ESTADO_ABIERTA);
        return jornadaRepository.save(jornada);
    }

    public Jornada cerrarJornada(Integer id) {
        Jornada jornada = obtenerPorId(id);
        if (ESTADO_CERRADA.equalsIgnoreCase(jornada.getEstado())) {
            throw new PagodaException(ErrorCode.JORNADA_CERRADA);
        }
        jornada.setEstado(ESTADO_CERRADA);
        jornada.setHoraCierre(LocalDateTime.now());
        return jornadaRepository.save(jornada);
    }
}

