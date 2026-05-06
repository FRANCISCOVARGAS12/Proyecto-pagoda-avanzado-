package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenPropinasRepository;
import com.pagoda.pagoda_api.repository.ventas.PagoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ResumenPropinaDiarioService {

    private final ResumenPropinasRepository repository;
    private final PagoRepository pagoRepository;

    public List<ResumenPropinaDiario> listarPorJornada(Integer jornadaId) {
        return repository.findByJornadaId(jornadaId);
    }

    public ResumenPropinaDiario guardar(ResumenPropinaDiario resumen) {
        resumen.setFechaGeneracion(LocalDateTime.now());
        return repository.save(resumen);
    }

    // ✅ Total de propinas en cualquier rango de fechas
    public BigDecimal getTotalPropinaEntreFechas(LocalDate inicio, LocalDate fin) {
        return pagoRepository.sumPropinasNetasByRango(inicio, fin);
    }

    // ✅ Total en el periodo actual de 15 días (deslizante)
    public BigDecimal getTotalPropinaPeriodoActual() {
        LocalDate hoy = LocalDate.now();
        int offset = (hoy.getDayOfMonth() - 1) % 15;
        LocalDate inicio = hoy.minusDays(offset);
        LocalDate fin = inicio.plusDays(14);
        return getTotalPropinaEntreFechas(inicio, fin);
    }
}
