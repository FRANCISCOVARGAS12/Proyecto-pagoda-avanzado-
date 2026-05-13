package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.config.BusinessClock;
import com.pagoda.pagoda_api.entity.ventas.Venta;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.ventas.VentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VentaService {

    private final VentaRepository ventaRepository;
    private final JornadaService jornadaService;
    private final PagoService pagoService;
    private final ResumenPlatillosDiarioService resumenPlatillosDiarioService;
    private final ResumenPropinaDiarioService resumenPropinaDiarioService;
    private final SimpMessagingTemplate messagingTemplate;
    private final BusinessClock businessClock;

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
        venta.setFechaCreacion(businessClock.now());
        venta.setFechaCierre(null);
        venta.setTotalCuenta(venta.getTotalCuenta() == null ? BigDecimal.ZERO : venta.getTotalCuenta());
        Venta saved = ventaRepository.save(venta);

        // Publicar evento de pedido creado
        publishPedidoEvent("CREADO", saved);

        return saved;
    }

    public Venta cerrar(Integer id) {
        Venta venta = obtenerPorId(id);
        if (venta.getFechaCierre() != null) {
            throw new PagodaException(ErrorCode.VENTA_YA_CERRADA);
        }

        pagoService.normalizeSalePaymentsIfNeeded(venta.getId(), venta.getTotalCuenta());

        venta.setFechaCierre(businessClock.now());
        Venta saved = ventaRepository.save(venta);

        // Publicar evento de pedido cerrado (reemplaza la antigua publicación a /topic/ventas)
        publishPedidoEvent("CERRADO", saved);

        LocalDate fechaEvento = saved.getJornada() != null && saved.getJornada().getFecha() != null
                ? saved.getJornada().getFecha()
                : businessClock.today();

        List<Map<String, Object>> top5 = resumenPlatillosDiarioService.obtenerTop5Resumen(fechaEvento, fechaEvento);
        messagingTemplate.convertAndSend("/topic/top5",
                (Object) Map.of("fecha", fechaEvento.toString(), "top5", top5));

        ResumenPropinaDiarioService.PropinasPeriodo periodo = resumenPropinaDiarioService.resolveCurrentPeriod();
        LocalDate periodoInicio = periodo.inicio();
        LocalDate periodoFin = periodo.fin();
        BigDecimal acumulado = resumenPropinaDiarioService.getTotalPropinaEntreFechas(periodoInicio, periodoFin);
        messagingTemplate.convertAndSend("/topic/propinas",
                (Object) Map.of("acumulado", acumulado, "periodoInicio", periodoInicio.toString()));

        return saved;
    }

    private void publishPedidoEvent(String accion, Venta venta) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("accion", accion);
        payload.put("pedido", venta);
        payload.put("pedidoId", venta.getId());
        if (venta.getJornada() != null) {
            payload.put("jornadaId", venta.getJornada().getId());
            if (venta.getJornada().getFecha() != null) {
                payload.put("fechaJornada", venta.getJornada().getFecha().toString());
            }
        }
        messagingTemplate.convertAndSend("/topic/pedido", (Object) payload);
    }
}
