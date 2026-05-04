package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.reportes.ResumenPlatillosDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenPlatillosRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

    public List<Map<String, Object>> obtenerTop5Resumen(LocalDate inicio, LocalDate fin) {
        return obtenerTop5(inicio, fin).stream().map(row -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("nombre", row[0]);
            map.put("categoria", row[1] != null ? row[1] : "Sin categoría");
            map.put("cantidadVendida", row[2]);
            map.put("totalGenerado", row[3]);
            return map;
        }).collect(Collectors.toList());
    }
}
