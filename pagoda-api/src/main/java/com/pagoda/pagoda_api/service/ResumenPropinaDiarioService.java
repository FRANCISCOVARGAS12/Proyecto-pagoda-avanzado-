package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.config.BusinessClock;
import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenPropinasRepository;
import com.pagoda.pagoda_api.repository.ventas.PagoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ResumenPropinaDiarioService {

    private final ResumenPropinasRepository repository;
    private final PagoRepository pagoRepository;
    private final BusinessClock businessClock;
    private static final LocalDate PROPINAS_BASE_DATE = LocalDate.of(2026, 4, 26);
    private static final int PROPINAS_PERIOD_DAYS = 15;

    public List<ResumenPropinaDiario> listarPorJornada(Integer jornadaId) {
        return repository.findByJornadaId(jornadaId);
    }

    public ResumenPropinaDiario guardar(ResumenPropinaDiario resumen) {
        resumen.setFechaGeneracion(businessClock.now());
        return repository.save(resumen);
    }

    // ✅ Total de propinas en cualquier rango de fechas
    public BigDecimal getTotalPropinaEntreFechas(LocalDate inicio, LocalDate fin) {
        return pagoRepository.sumPropinasNetasByRango(inicio, fin);
    }

    public List<Map<String, Object>> getDetallePropinasEntreFechas(LocalDate inicio, LocalDate fin) {
        return pagoRepository.findDetallePropinasByRango(inicio, fin).stream().map(row -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("folio", row[0]);
            map.put("fecha", row[1] == null ? null : row[1].toString());
            map.put("mesa", row[2]);
            map.put("propinaEfectivo", row[3] instanceof BigDecimal ? row[3] : BigDecimal.ZERO);
            map.put("propinaTarjetaBruto", row[4] instanceof BigDecimal ? row[4] : BigDecimal.ZERO);
            map.put("propinaTarjetaNeto", row[5] instanceof BigDecimal ? row[5] : BigDecimal.ZERO);
            map.put("totalNeto", row[6] instanceof BigDecimal ? row[6] : BigDecimal.ZERO);
            return map;
        }).toList();
    }

    // ✅ Total en el periodo actual de 15 días (deslizante)
    public BigDecimal getTotalPropinaPeriodoActual() {
        PropinasPeriodo periodo = resolveCurrentPeriod();
        LocalDate inicio = periodo.inicio();
        LocalDate fin = periodo.fin();
        return getTotalPropinaEntreFechas(inicio, fin);
    }

    public PropinasPeriodo resolveCurrentPeriod() {
        return resolvePeriodForDate(businessClock.today());
    }

    public PropinasPeriodo resolvePeriodForDate(LocalDate targetDate) {
        LocalDate objetivo = targetDate == null ? businessClock.today() : targetDate;
        if (objetivo.isBefore(PROPINAS_BASE_DATE)) {
            LocalDate finPrimerPeriodo = PROPINAS_BASE_DATE.plusDays(PROPINAS_PERIOD_DAYS - 1L);
            return new PropinasPeriodo(PROPINAS_BASE_DATE, finPrimerPeriodo);
        }

        long diffDays = ChronoUnit.DAYS.between(PROPINAS_BASE_DATE, objetivo);
        long offsetBlocks = (diffDays / PROPINAS_PERIOD_DAYS) * PROPINAS_PERIOD_DAYS;
        LocalDate inicio = PROPINAS_BASE_DATE.plusDays(offsetBlocks);
        LocalDate fin = inicio.plusDays(PROPINAS_PERIOD_DAYS - 1L);
        return new PropinasPeriodo(inicio, fin);
    }

    public record PropinasPeriodo(LocalDate inicio, LocalDate fin) {}
}
