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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoRepository pagoRepository;
    private final ResumenPropinaDiarioService resumenPropinaDiarioService;
    private final ParametrosLocalService parametrosLocalService;
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
        pago.setPropinaNeto(normalizeTipNet(resolveTipNet(pago, propinaMonto, comision), propinaMonto));

        Pago saved = pagoRepository.save(pago);
        publishPropinasUpdate();
        return saved;
    }

    public void normalizeSalePaymentsIfNeeded(Integer ventaId, BigDecimal totalCuentaVenta) {
        if (ventaId == null || totalCuentaVenta == null || totalCuentaVenta.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        List<Pago> pagos = pagoRepository.findByVentaId(ventaId);
        if (pagos.isEmpty()) {
            return;
        }

        BigDecimal targetBaseTotal = normalizeMoney(totalCuentaVenta);
        BigDecimal currentBaseTotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal adjustedBaseTotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        for (Pago pago : pagos) {
            BigDecimal currentAmount = normalizeMoney(pago.getMonto());
            BigDecimal tipAmount = normalizeMoney(pago.getPropinaMonto());
            currentBaseTotal = currentBaseTotal.add(currentAmount);
            adjustedBaseTotal = adjustedBaseTotal.add(extractBaseAmount(currentAmount, tipAmount));
        }

        boolean separateTipFromAmount = isAdjustmentCloserToTarget(targetBaseTotal, currentBaseTotal, adjustedBaseTotal);
        List<Pago> pagosActualizados = new ArrayList<>();

        for (Pago pago : pagos) {
            BigDecimal tipAmount = normalizeMoney(pago.getPropinaMonto());
            BigDecimal amount = normalizeMoney(pago.getMonto());

            if (separateTipFromAmount) {
                amount = extractBaseAmount(amount, tipAmount);
                pago.setMonto(amount);
                pago.setMontoNeto(calculateNetAmount(amount, normalizePercentage(pago.getComisionPorcentaje())));
            }

            BigDecimal tipNet = normalizeTipNet(resolveTipNet(pago, tipAmount, normalizePercentage(pago.getComisionPorcentaje())), tipAmount);
            if (pago.getPropinaNeto() == null || pago.getPropinaNeto().compareTo(tipNet) != 0) {
                pago.setPropinaNeto(tipNet);
                pagosActualizados.add(pago);
                continue;
            }

            if (separateTipFromAmount) {
                pagosActualizados.add(pago);
            }
        }

        if (!pagosActualizados.isEmpty()) {
            pagoRepository.saveAll(pagosActualizados);
        }
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizePercentage(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return value.stripTrailingZeros();
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

        String tipMethodName = pago.getPropinaMetodoPago() == null
                ? null
                : pago.getPropinaMetodoPago().getNombre();
        if (tipMethodName == null || tipMethodName.isBlank()) {
            tipMethodName = pago.getMetodoPago() == null ? null : pago.getMetodoPago().getNombre();
        }

        BigDecimal providedTipNet = pago.getPropinaNeto();
        if (providedTipNet != null) {
            BigDecimal normalizedProvided = normalizeMoney(providedTipNet);
            if (normalizedProvided.compareTo(BigDecimal.ZERO) > 0
                    && normalizedProvided.compareTo(tipAmount) < 0) {
                return normalizedProvided;
            }
        }

        if (isCardMethod(tipMethodName)) {
            BigDecimal tipCommission = resolveTipCommission(commission);
            if (providedTipNet != null) {
                BigDecimal normalizedProvided = normalizeMoney(providedTipNet);
                if (normalizedProvided.compareTo(BigDecimal.ZERO) > 0
                        && normalizedProvided.compareTo(tipAmount) <= 0
                        && (normalizedProvided.compareTo(tipAmount) < 0
                        || tipCommission.compareTo(BigDecimal.ZERO) == 0)) {
                    return normalizedProvided;
                }
            }

            return calculateNetAmount(tipAmount, tipCommission);
        }

        return tipAmount;
    }

    private BigDecimal resolveTipCommission(BigDecimal paymentCommission) {
        BigDecimal normalizedPaymentCommission = normalizePercentage(paymentCommission);
        if (normalizedPaymentCommission.compareTo(BigDecimal.ZERO) > 0) {
            return normalizedPaymentCommission;
        }

        try {
            return normalizePercentage(parametrosLocalService.obtener().getComisionBancaria());
        } catch (RuntimeException ignored) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
    }

    private BigDecimal normalizeTipNet(BigDecimal tipNet, BigDecimal tipAmount) {
        if (tipAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal normalizedTipNet = normalizeMoney(tipNet);
        if (normalizedTipNet.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (normalizedTipNet.compareTo(tipAmount) > 0) {
            return tipAmount;
        }
        return normalizedTipNet;
    }

    private BigDecimal extractBaseAmount(BigDecimal amount, BigDecimal tipAmount) {
        if (tipAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return amount;
        }
        if (amount.compareTo(tipAmount) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return amount.subtract(tipAmount).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean isAdjustmentCloserToTarget(BigDecimal target, BigDecimal current, BigDecimal adjusted) {
        BigDecimal currentDiff = current.subtract(target).abs();
        BigDecimal adjustedDiff = adjusted.subtract(target).abs();
        return adjustedDiff.add(new BigDecimal("0.01")).compareTo(currentDiff) < 0;
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
