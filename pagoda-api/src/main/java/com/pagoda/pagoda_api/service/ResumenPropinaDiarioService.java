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
import java.util.List;

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
