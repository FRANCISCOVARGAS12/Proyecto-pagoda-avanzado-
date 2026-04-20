package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.JornadaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JornadaServiceTest {

    @Mock
    private JornadaRepository jornadaRepository;

    @InjectMocks
    private JornadaService jornadaService;

    @Test
    void abrirJornada_debeFallarSiYaExisteJornadaAbierta() {
        when(jornadaRepository.findByEstadoIgnoreCase("ABIERTA")).thenReturn(Optional.of(new Jornada()));

        assertThrows(PagodaException.class, () -> jornadaService.abrirJornada(new Jornada()));
    }
}

