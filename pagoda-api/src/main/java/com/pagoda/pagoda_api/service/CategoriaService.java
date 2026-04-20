package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.Categoria;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.CategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoriaService {

    private final CategoriaRepository categoriaRepository;

    public List<Categoria> obtenerTodas() {
        return categoriaRepository.findAll();
    }

    public Categoria obtenerPorId(Integer id) {
        return categoriaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.CATEGORIA_NO_ENCONTRADA));
    }

    public Categoria crear(Categoria categoria) {
        if (categoriaRepository.existsByNombre(categoria.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_CATEGORIA_DUPLICADO);
        }
        return categoriaRepository.save(categoria);
    }

    public Categoria actualizar(Integer id, Categoria payload) {
        Categoria actual = obtenerPorId(id);
        if (!actual.getNombre().equalsIgnoreCase(payload.getNombre())
                && categoriaRepository.existsByNombre(payload.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_CATEGORIA_DUPLICADO);
        }
        actual.setNombre(payload.getNombre());
        actual.setDescripcion(payload.getDescripcion());
        return categoriaRepository.save(actual);
    }

    public void eliminar(Integer id) {
        Categoria categoria = obtenerPorId(id);
        categoriaRepository.delete(categoria);
    }
}