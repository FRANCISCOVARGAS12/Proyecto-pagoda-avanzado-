package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Producto;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.ProductoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductoServiceTest {

    @Mock
    private ProductoRepository productoRepository;

    @InjectMocks
    private ProductoService productoService;

    @Test
    void eliminar_debeFallarCuandoNoExisteProducto() {
        when(productoRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(PagodaException.class, () -> productoService.eliminar(999));
    }
}

