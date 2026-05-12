package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.ventas.Pago;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.ventas.PagoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

        BigDecimal monto = normalizeMoney(pago.getMonto());
        BigDecimal comision = normalizePercentage(pago.getComisionPorcentaje());

        pago.setMonto(monto);
        pago.setComisionPorcentaje(comision);
        pago.setMontoNeto(calculateNetAmount(monto, comision));

        BigDecimal propinaMonto = normalizeMoney(pago.getPropinaMonto());
        pago.setPropinaMonto(propinaMonto);
        pago.setPropinaNeto(resolveTipNet(pago, propinaMonto, comision));

        Pago saved = pagoRepository.save(pago);
        publishPropinasUpdate();
        return saved;
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizePercentage(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateNetAmount(BigDecimal amount, BigDecimal percentage) {
        BigDecimal commission = amount
                .multiply(percentage)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        return amount.subtract(commission).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveTipNet(Pago pago, BigDecimal tipAmount, BigDecimal commission) {
        if (tipAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        if (isCardMethod(pago.getPropinaMetodoPago() == null ? null : pago.getPropinaMetodoPago().getNombre())) {
            if (isCardMethod(pago.getMetodoPago() == null ? null : pago.getMetodoPago().getNombre())) {
                return calculateNetAmount(tipAmount, commission);
            }
            if (pago.getPropinaNeto() != null && pago.getPropinaNeto().compareTo(BigDecimal.ZERO) > 0) {
                return normalizeMoney(pago.getPropinaNeto());
            }
            return tipAmount;
        }

        return tipAmount;
    }

    private boolean isCardMethod(String methodName) {
        return methodName != null && methodName.toLowerCase().contains("tarjeta");
    }

    private void publishPropinasUpdate() {
        ResumenPropinaDiarioService.PropinasPeriodo periodo = resumenPropinaDiarioService.resolveCurrentPeriod();
        LocalDate periodoInicio = periodo.inicio();
        LocalDate periodoFin = periodo.fin();

        BigDecimal acumulado = resumenPropinaDiarioService.getTotalPropinaEntreFechas(periodoInicio, periodoFin);
        messagingTemplate.convertAndSend("/topic/propinas",
                (Object) Map.of("acumulado", acumulado, "periodoInicio", periodoInicio.toString()));
    }
}
