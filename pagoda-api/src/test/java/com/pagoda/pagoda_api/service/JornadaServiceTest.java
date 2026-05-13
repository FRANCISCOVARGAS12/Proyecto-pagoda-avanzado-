package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.config.BusinessClock;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.JornadaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JornadaServiceTest {

    @Mock
    private JornadaRepository jornadaRepository;

    @Mock
    private BusinessClock businessClock;

    @InjectMocks
    private JornadaService jornadaService;

    @Test
    void abrirJornada_debeFallarSiYaExisteJornadaAbierta() {
        when(businessClock.today()).thenReturn(LocalDate.of(2026, 5, 11));
        when(jornadaRepository.findByEstadoIgnoreCase("ABIERTA")).thenReturn(Optional.of(new Jornada()));

        assertThrows(PagodaException.class, () -> jornadaService.abrirJornada(new Jornada()));
    }

    @Test
    void obtenerJornadaAbierta_cierraJornadaAnteriorAMedianoche() {
        Jornada jornadaAnterior = Jornada.builder()
                .id(15)
                .fecha(LocalDate.of(2026, 5, 11))
                .horaApertura(LocalDateTime.of(2026, 5, 11, 18, 0))
                .estado("ABIERTA")
                .build();

        when(businessClock.today()).thenReturn(LocalDate.of(2026, 5, 12));
        when(jornadaRepository.findAllByEstadoIgnoreCase("ABIERTA")).thenReturn(List.of(jornadaAnterior));
        when(jornadaRepository.save(any(Jornada.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Optional<Jornada> abierta = jornadaService.obtenerJornadaAbierta();

        assertEquals(Optional.empty(), abierta);
        ArgumentCaptor<Jornada> captor = ArgumentCaptor.forClass(Jornada.class);
        verify(jornadaRepository).save(captor.capture());
        Jornada cerrada = captor.getValue();
        assertEquals("CERRADA", cerrada.getEstado());
        assertEquals(LocalDateTime.of(2026, 5, 12, 0, 0), cerrada.getHoraCierre());
    }
}
