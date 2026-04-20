package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.ventas.ItemVenta;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.ventas.ItemVentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ItemVentaService {

    private final ItemVentaRepository itemVentaRepository;

    public List<ItemVenta> listarPorVenta(Integer ventaId) {
        return itemVentaRepository.findByVentaId(ventaId);
    }

    public ItemVenta obtenerPorId(Integer id) {
        return itemVentaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.ITEM_NO_ENCONTRADO));
    }

    public ItemVenta crear(ItemVenta itemVenta) {
        return itemVentaRepository.save(itemVenta);
    }

    public void eliminar(Integer id) {
        ItemVenta itemVenta = obtenerPorId(id);
        itemVentaRepository.delete(itemVenta);
    }
}

