package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import com.pagoda.pagoda_api.repository.reportes.ResumenPropinasRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ResumenPropinaDiarioService {

    private final ResumenPropinasRepository repository;

    public List<ResumenPropinaDiario> listarPorJornada(Integer jornadaId) {
        return repository.findByJornadaId(jornadaId);
    }

    public ResumenPropinaDiario guardar(ResumenPropinaDiario resumen) {
        resumen.setFechaGeneracion(LocalDateTime.now());
        return repository.save(resumen);
    }

    public BigDecimal obtenerPropinasPorQuincena() {
        LocalDate hoy = LocalDate.now();
        LocalDate inicio, fin;

        // Determinar si estamos en la primera quincena (1-15) o segunda (16-final)
        if (hoy.getDayOfMonth() <= 15) {
            // Primera quincena: del 1 al 15
            inicio = LocalDate.of(hoy.getYear(), hoy.getMonth(), 1);
            fin = LocalDate.of(hoy.getYear(), hoy.getMonth(), 15);
        } else {
            // Segunda quincena: del 16 al último día del mes
            inicio = LocalDate.of(hoy.getYear(), hoy.getMonth(), 16);
            fin = hoy.withDayOfMonth(hoy.getMonth().length(hoy.isLeapYear()));
        }

        // Convertir a LocalDateTime para búsqueda
        LocalDateTime inicioDateTime = inicio.atStartOfDay();
        LocalDateTime finDateTime = fin.atTime(23, 59, 59);

        // Obtener todos los resúmenes de propinas en el rango de la quincena
        List<ResumenPropinaDiario> propinasQuincena = repository.findByJornadaFechaBetween(inicio, fin);

        // Sumar todas las propinas netas
        return propinasQuincena.stream()
                .map(ResumenPropinaDiario::getTotalPropinasNeto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}

