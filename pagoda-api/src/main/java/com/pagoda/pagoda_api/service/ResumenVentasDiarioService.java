package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.reportes.ResumenVentasDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenVentasRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ResumenVentasDiarioService {

    private final ResumenVentasRepository repository;

    public List<ResumenVentasDiario> listarPorJornada(Integer jornadaId) {
        return repository.findByJornadaId(jornadaId);
    }

    public ResumenVentasDiario guardar(ResumenVentasDiario resumen) {
        resumen.setFechaGeneracion(LocalDateTime.now());
        return repository.save(resumen);
    }
}

