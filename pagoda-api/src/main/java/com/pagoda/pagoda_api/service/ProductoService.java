package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Producto;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductoService {

    private final ProductoRepository productoRepository;

    public List<Producto> obtenerTodos() {
        return productoRepository.findByActivoTrue();
    }

    public List<Producto> obtenerPorCategoria(Integer categoriaId) {
        return productoRepository.findByCategoriaIdAndActivoTrue(categoriaId);
    }

    public Producto guardar(Producto producto) {
        if (producto.getId() == null && productoRepository.existsByNombre(producto.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_PRODUCTO_DUPLICADO);
        }
        return productoRepository.save(producto);
    }

    public Producto obtenerPorId(Integer id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.PRODUCTO_NO_ENCONTRADO));
    }

    public Producto actualizar(Integer id, Producto payload) {
        Producto actual = obtenerPorId(id);
        actual.setNombre(payload.getNombre());
        actual.setDescripcion(payload.getDescripcion());
        actual.setPrecio(payload.getPrecio());
        actual.setCategoria(payload.getCategoria());
        if (payload.getActivo() != null) {
            actual.setActivo(payload.getActivo());
        }
        return productoRepository.save(actual);
    }

    public void eliminar(Integer id) {
        Producto producto = productoRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.PRODUCTO_NO_ENCONTRADO));
        producto.setActivo(false);
        productoRepository.save(producto);
    }
}