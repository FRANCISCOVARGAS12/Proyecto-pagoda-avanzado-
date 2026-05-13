package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.MetodoPago;
import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import com.pagoda.pagoda_api.entity.ventas.Pago;
import com.pagoda.pagoda_api.repository.ventas.PagoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PagoServiceTest {

    @Mock
    private PagoRepository pagoRepository;

    @Mock
    private ResumenPropinaDiarioService resumenPropinaDiarioService;

    @Mock
    private ParametrosLocalService parametrosLocalService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private PagoService pagoService;

    @Test
    void crear_descuentaComisionConfiguradaEnPropinaTarjetaConPagoProductoEfectivo() {
        MetodoPago efectivo = MetodoPago.builder().id(1).nombre("EFECTIVO").build();
        MetodoPago tarjeta = MetodoPago.builder().id(2).nombre("TARJETA").build();
        Pago pago = Pago.builder()
                .metodoPago(efectivo)
                .monto(new BigDecimal("200.00"))
                .comisionPorcentaje(BigDecimal.ZERO)
                .propinaMonto(new BigDecimal("50.00"))
                .propinaMetodoPago(tarjeta)
                .build();

        when(parametrosLocalService.obtener()).thenReturn(ParametrosLocal.builder()
                .comisionBancaria(new BigDecimal("3.50"))
                .build());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(invocation -> invocation.getArgument(0));
        stubPropinasPeriod();

        Pago saved = pagoService.crear(pago);

        assertEquals(0, new BigDecimal("200.00").compareTo(saved.getMonto()));
        assertEquals(0, new BigDecimal("200.00").compareTo(saved.getMontoNeto()));
        assertEquals(0, new BigDecimal("48.25").compareTo(saved.getPropinaNeto()));
    }

    @Test
    void crear_descuentaTresPuntoSieteEnPropinaTarjetaPorComensales() {
        MetodoPago tarjeta = MetodoPago.builder().id(2).nombre("TARJETA").build();
        Pago pago = Pago.builder()
                .metodoPago(tarjeta)
                .monto(new BigDecimal("300.00"))
                .comisionPorcentaje(new BigDecimal("3.70"))
                .propinaMonto(new BigDecimal("48.00"))
                .propinaMetodoPago(tarjeta)
                .build();

        when(pagoRepository.save(any(Pago.class))).thenAnswer(invocation -> invocation.getArgument(0));
        stubPropinasPeriod();

        Pago saved = pagoService.crear(pago);

        assertEquals(0, new BigDecimal("288.90").compareTo(saved.getMontoNeto()));
        assertEquals(0, new BigDecimal("46.22").compareTo(saved.getPropinaNeto()));
    }

    @Test
    void crear_respetaPropinaNetaHistoricaValida() {
        MetodoPago tarjeta = MetodoPago.builder().id(2).nombre("TARJETA").build();
        Pago pago = Pago.builder()
                .metodoPago(tarjeta)
                .monto(new BigDecimal("199.99"))
                .comisionPorcentaje(new BigDecimal("3.70"))
                .propinaMonto(new BigDecimal("50.00"))
                .propinaMetodoPago(tarjeta)
                .propinaNeto(new BigDecimal("48.15"))
                .build();

        when(pagoRepository.save(any(Pago.class))).thenAnswer(invocation -> invocation.getArgument(0));
        stubPropinasPeriod();

        Pago saved = pagoService.crear(pago);

        assertEquals(0, new BigDecimal("199.99").compareTo(saved.getMonto()));
        assertEquals(0, new BigDecimal("192.59").compareTo(saved.getMontoNeto()));
        assertEquals(0, new BigDecimal("48.15").compareTo(saved.getPropinaNeto()));
    }

    @Test
    void normalizeSalePaymentsIfNeeded_separaPropinaDeMontoHistorico() {
        Pago pago = Pago.builder()
                .id(1)
                .monto(new BigDecimal("250.00"))
                .comisionPorcentaje(new BigDecimal("3.50"))
                .montoNeto(new BigDecimal("241.25"))
                .propinaMonto(new BigDecimal("50.00"))
                .propinaNeto(new BigDecimal("48.25"))
                .build();

        when(pagoRepository.findByVentaId(77)).thenReturn(List.of(pago));

        pagoService.normalizeSalePaymentsIfNeeded(77, new BigDecimal("200.00"));

        ArgumentCaptor<List<Pago>> captor = pagosListCaptor();
        verify(pagoRepository).saveAll(captor.capture());

        Pago actualizado = captor.getValue().getFirst();
        assertEquals(0, new BigDecimal("200.00").compareTo(actualizado.getMonto()));
        assertEquals(0, new BigDecimal("193.00").compareTo(actualizado.getMontoNeto()));
        assertEquals(0, new BigDecimal("48.25").compareTo(actualizado.getPropinaNeto()));
    }

    @Test
    void normalizeSalePaymentsIfNeeded_noAlteraPagoCorrectoSinSobreconteo() {
        Pago pago = Pago.builder()
                .id(2)
                .monto(new BigDecimal("200.00"))
                .comisionPorcentaje(new BigDecimal("3.50"))
                .montoNeto(new BigDecimal("193.00"))
                .propinaMonto(new BigDecimal("50.00"))
                .propinaNeto(new BigDecimal("48.25"))
                .build();

        when(pagoRepository.findByVentaId(88)).thenReturn(List.of(pago));

        pagoService.normalizeSalePaymentsIfNeeded(88, new BigDecimal("200.00"));

        verify(pagoRepository, never()).saveAll(anyList());
    }

    @Test
    void normalizeSalePaymentsIfNeeded_acotaPropinaNetaCorrupta() {
        Pago pago = Pago.builder()
                .id(3)
                .monto(new BigDecimal("200.00"))
                .comisionPorcentaje(new BigDecimal("0"))
                .montoNeto(new BigDecimal("200.00"))
                .propinaMonto(new BigDecimal("50.00"))
                .propinaNeto(new BigDecimal("120.00"))
                .build();

        when(pagoRepository.findByVentaId(99)).thenReturn(List.of(pago));

        pagoService.normalizeSalePaymentsIfNeeded(99, new BigDecimal("200.00"));

        ArgumentCaptor<List<Pago>> captor = pagosListCaptor();
        verify(pagoRepository).saveAll(captor.capture());

        Pago actualizado = captor.getValue().getFirst();
        assertEquals(0, new BigDecimal("200.00").compareTo(actualizado.getMonto()));
        assertEquals(0, new BigDecimal("50.00").compareTo(actualizado.getPropinaNeto()));
    }

    @Test
    void normalizeSalePaymentsIfNeeded_recalculaPropinaTarjetaGuardadaComoBruta() {
        MetodoPago tarjeta = MetodoPago.builder().id(2).nombre("TARJETA").build();
        Pago pago = Pago.builder()
                .id(4)
                .metodoPago(tarjeta)
                .propinaMetodoPago(tarjeta)
                .monto(new BigDecimal("200.00"))
                .comisionPorcentaje(new BigDecimal("3.50"))
                .montoNeto(new BigDecimal("193.00"))
                .propinaMonto(new BigDecimal("50.00"))
                .propinaNeto(new BigDecimal("50.00"))
                .build();

        when(pagoRepository.findByVentaId(100)).thenReturn(List.of(pago));

        pagoService.normalizeSalePaymentsIfNeeded(100, new BigDecimal("200.00"));

        ArgumentCaptor<List<Pago>> captor = pagosListCaptor();
        verify(pagoRepository).saveAll(captor.capture());

        Pago actualizado = captor.getValue().getFirst();
        assertEquals(0, new BigDecimal("200.00").compareTo(actualizado.getMonto()));
        assertEquals(0, new BigDecimal("48.25").compareTo(actualizado.getPropinaNeto()));
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<List<Pago>> pagosListCaptor() {
        return (ArgumentCaptor<List<Pago>>) (ArgumentCaptor<?>) ArgumentCaptor.forClass(List.class);
    }

    private void stubPropinasPeriod() {
        ResumenPropinaDiarioService.PropinasPeriodo periodo =
                new ResumenPropinaDiarioService.PropinasPeriodo(
                        LocalDate.of(2026, 5, 11),
                        LocalDate.of(2026, 5, 25)
                );
        when(resumenPropinaDiarioService.resolveCurrentPeriod()).thenReturn(periodo);
        when(resumenPropinaDiarioService.getTotalPropinaEntreFechas(periodo.inicio(), periodo.fin()))
                .thenReturn(BigDecimal.ZERO);
    }
}
