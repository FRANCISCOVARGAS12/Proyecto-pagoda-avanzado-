package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.ventas.Pago;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.ventas.PagoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoRepository pagoRepository;
    private final ResumenPropinaDiarioService resumenPropinaDiarioService;
    private final SimpMessagingTemplate messagingTemplate;

    public List<Pago> listarPorVenta(Integer ventaId) {
        return pagoRepository.findByVentaId(ventaId);
    }

    public Pago obtenerPorId(Integer id) {
        return pagoRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.PAGO_NO_ENCONTRADO));
    }

    public Pago crear(Pago pago) {
        if (pago.getMonto() == null || pago.getMonto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new PagodaException(ErrorCode.MONTO_PAGO_INVALIDO);
        }
        Pago saved = pagoRepository.save(pago);
        publishPropinasUpdate();
        return saved;
    }

    private void publishPropinasUpdate() {
        LocalDate hoy = LocalDate.now();
        int offset = (hoy.getDayOfMonth() - 1) % 15;
        LocalDate periodoInicio = hoy.minusDays(offset);
        LocalDate periodoFin = periodoInicio.plusDays(14);

        BigDecimal acumulado = resumenPropinaDiarioService.getTotalPropinaEntreFechas(periodoInicio, periodoFin);
        messagingTemplate.convertAndSend("/topic/propinas",
                (Object) Map.of("acumulado", acumulado, "periodoInicio", periodoInicio.toString()));
    }
}
