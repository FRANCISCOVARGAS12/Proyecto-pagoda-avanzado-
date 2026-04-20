package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.reportes.ResumenPlatillosDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenPlatillosRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
}

