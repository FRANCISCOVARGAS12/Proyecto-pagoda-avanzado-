package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.config.BusinessClock;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.JornadaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertThrows;
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
}
