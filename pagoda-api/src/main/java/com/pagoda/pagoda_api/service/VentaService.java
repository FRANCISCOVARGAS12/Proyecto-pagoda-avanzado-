package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.ventas.Venta;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.ventas.VentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VentaService {

    private final VentaRepository ventaRepository;
    private final JornadaService jornadaService;

    public List<Venta> listarActivas() {
        return ventaRepository.findByFechaCierreIsNull();
    }

    public List<Venta> listarPorJornada(Integer jornadaId) {
        return ventaRepository.findByJornadaIdOrderByFechaCreacionDesc(jornadaId);
    }

    public Venta obtenerPorId(Integer id) {
        return ventaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.VENTA_NO_ENCONTRADA));
    }

    public Venta abrir(Venta venta) {
        if (venta.getMesa() == null || venta.getMesa().getId() == null) {
            throw new PagodaException(ErrorCode.MESA_NO_ENCONTRADA);
        }
        if (venta.getUsuario() == null || venta.getUsuario().getId() == null) {
            throw new PagodaException(ErrorCode.USUARIO_NO_ENCONTRADO);
        }
        if (ventaRepository.existsByMesaIdAndFechaCierreIsNull(venta.getMesa().getId())) {
            throw new PagodaException(ErrorCode.MESA_OCUPADA);
        }

        venta.setJornada(jornadaService.asegurarJornadaActiva(venta.getUsuario()));
        venta.setFechaCreacion(LocalDateTime.now());
        venta.setFechaCierre(null);
        venta.setTotalCuenta(venta.getTotalCuenta() == null ? BigDecimal.ZERO : venta.getTotalCuenta());
        return ventaRepository.save(venta);
    }

    public Venta cerrar(Integer id) {
        Venta venta = obtenerPorId(id);
        if (venta.getFechaCierre() != null) {
            throw new PagodaException(ErrorCode.VENTA_YA_CERRADA);
        }
        venta.setFechaCierre(LocalDateTime.now());
        return ventaRepository.save(venta);
    }
}
