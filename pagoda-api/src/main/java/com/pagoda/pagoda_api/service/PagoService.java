package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.ventas.Pago;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.ventas.PagoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoRepository pagoRepository;

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
        return pagoRepository.save(pago);
    }
}

