package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.MetodoPago;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.MetodoPagoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MetodoPagoService {

    private final MetodoPagoRepository metodoPagoRepository;

    public List<MetodoPago> listar() {
        return metodoPagoRepository.findAll();
    }

    public MetodoPago obtenerPorId(Integer id) {
        return metodoPagoRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.METODO_PAGO_NO_ENCONTRADO));
    }

    public MetodoPago crear(MetodoPago metodoPago) {
        if (metodoPagoRepository.existsByNombre(metodoPago.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_METODO_PAGO_DUPLICADO);
        }
        return metodoPagoRepository.save(metodoPago);
    }

    public MetodoPago actualizar(Integer id, MetodoPago payload) {
        MetodoPago actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && metodoPagoRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_METODO_PAGO_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        return metodoPagoRepository.save(actual);
    }

    public void eliminar(Integer id) {
        MetodoPago metodoPago = obtenerPorId(id);
        metodoPagoRepository.delete(metodoPago);
    }
}

