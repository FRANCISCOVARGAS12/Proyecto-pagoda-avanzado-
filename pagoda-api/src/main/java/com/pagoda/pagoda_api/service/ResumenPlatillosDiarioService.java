package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.reportes.ResumenPlatillosDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenPlatillosRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ResumenPlatillosDiarioService {

    private final ResumenPlatillosRepository repository;

    public List<ResumenPlatillosDiario> listarPorJornada(Integer jornadaId) {
        return repository.findByJornadaId(jornadaId);
    }

    public ResumenPlatillosDiario guardar(ResumenPlatillosDiario resumen) {
        resumen.setFechaGeneracion(LocalDateTime.now());
        return repository.save(resumen);
    }

    public List<ResumenPlatillosDiario> obtenerTop5(LocalDate fecha) {
        return repository.findTop5ByFechaOrderByTotalGeneradoDesc(fecha);
    }

    public List<Object[]> obtenerTop5(LocalDate inicio, LocalDate fin) {
        return repository.findTop5ByFechaBetween(inicio, fin, PageRequest.of(0, 5));
    }
}

