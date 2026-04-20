package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.CierreDia;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.CierreDiaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CierreDiaService {

    private final CierreDiaRepository cierreDiaRepository;
    private final JornadaService jornadaService;

    public List<CierreDia> listarTodos() {
        return cierreDiaRepository.findAll();
    }

    public CierreDia obtenerPorId(Integer id) {
        return cierreDiaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.CIERRE_NO_ENCONTRADO));
    }

    public CierreDia generar(CierreDia cierreDia) {
        Jornada jornada = jornadaService.obtenerPorId(cierreDia.getJornada().getId());
        if (cierreDiaRepository.findByJornadaId(jornada.getId()).isPresent()) {
            throw new PagodaException(ErrorCode.CIERRE_YA_EXISTE_PARA_JORNADA);
        }
        cierreDia.setJornada(jornada);
        cierreDia.setFecha(cierreDia.getFecha() == null ? LocalDate.now() : cierreDia.getFecha());
        cierreDia.setFechaGeneracion(LocalDateTime.now());
        cierreDia.setSaldoInicial(cierreDia.getSaldoInicial() == null ? BigDecimal.ZERO : cierreDia.getSaldoInicial());
        cierreDia.setVentas(cierreDia.getVentas() == null ? BigDecimal.ZERO : cierreDia.getVentas());
        cierreDia.setSaldoFinal(cierreDia.getSaldoFinal() == null ? BigDecimal.ZERO : cierreDia.getSaldoFinal());
        return cierreDiaRepository.save(cierreDia);
    }
}

