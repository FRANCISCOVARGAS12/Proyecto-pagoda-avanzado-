package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.EstadoItem;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.EstadoItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EstadoItemService {

    private final EstadoItemRepository estadoItemRepository;

    public List<EstadoItem> listar() {
        return estadoItemRepository.findAll();
    }

    public EstadoItem obtenerPorId(Integer id) {
        return estadoItemRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.ESTADO_ITEM_NO_ENCONTRADO));
    }

    public EstadoItem crear(EstadoItem estadoItem) {
        if (estadoItemRepository.existsByNombre(estadoItem.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_ESTADO_ITEM_DUPLICADO);
        }
        return estadoItemRepository.save(estadoItem);
    }

    public EstadoItem actualizar(Integer id, EstadoItem payload) {
        EstadoItem actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && estadoItemRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_ESTADO_ITEM_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        return estadoItemRepository.save(actual);
    }

    public void eliminar(Integer id) {
        EstadoItem estadoItem = obtenerPorId(id);
        estadoItemRepository.delete(estadoItem);
    }
}

