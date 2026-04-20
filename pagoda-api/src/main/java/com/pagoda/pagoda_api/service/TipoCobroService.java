package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.TipoCobro;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.TipoCobroRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TipoCobroService {

    private final TipoCobroRepository tipoCobroRepository;

    public List<TipoCobro> listar() {
        return tipoCobroRepository.findAll();
    }

    public TipoCobro obtenerPorId(Integer id) {
        return tipoCobroRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.TIPO_COBRO_NO_ENCONTRADO));
    }

    public TipoCobro crear(TipoCobro tipoCobro) {
        if (tipoCobroRepository.existsByNombre(tipoCobro.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_TIPO_COBRO_DUPLICADO);
        }
        return tipoCobroRepository.save(tipoCobro);
    }

    public TipoCobro actualizar(Integer id, TipoCobro payload) {
        TipoCobro actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && tipoCobroRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_TIPO_COBRO_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        return tipoCobroRepository.save(actual);
    }

    public void eliminar(Integer id) {
        TipoCobro tipoCobro = obtenerPorId(id);
        tipoCobroRepository.delete(tipoCobro);
    }
}

