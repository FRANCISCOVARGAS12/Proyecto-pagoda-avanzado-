package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.request.ProductoCreateRequest;
import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.Categoria;
import com.pagoda.pagoda_api.entity.operacion.Producto;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.CategoriaRepository;
import com.pagoda.pagoda_api.service.ProductoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/productos")
@RequiredArgsConstructor
public class ProductoController {

    private final ProductoService productoService;
    private final CategoriaRepository categoriaRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Producto>>> obtenerTodos() {
        return ResponseEntity.ok(
                ApiResponse.ok("Productos obtenidos correctamente", productoService.obtenerTodos())
        );
    }

    @GetMapping("/categoria/{categoriaId}")
    public ResponseEntity<ApiResponse<List<Producto>>> obtenerPorCategoria(@PathVariable Integer categoriaId) {
        return ResponseEntity.ok(
                ApiResponse.ok("Productos obtenidos correctamente", productoService.obtenerPorCategoria(categoriaId))
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Producto>> obtenerPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Producto obtenido correctamente", productoService.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Producto>> guardar(@Valid @RequestBody ProductoCreateRequest request) {
        Categoria categoria = categoriaRepository.findById(request.getCategoriaId())
                .orElseThrow(() -> new PagodaException(ErrorCode.CATEGORIA_NO_ENCONTRADA));

        Producto producto = Producto.builder()
                .nombre(request.getNombre())
                .descripcion(request.getDescripcion())
                .precio(request.getPrecio())
                .categoria(categoria)
                .activo(request.getActivo() == null || request.getActivo())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Producto guardado correctamente", productoService.guardar(producto)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Producto>> actualizar(@PathVariable Integer id, @Valid @RequestBody ProductoCreateRequest request) {
        Categoria categoria = categoriaRepository.findById(request.getCategoriaId())
                .orElseThrow(() -> new PagodaException(ErrorCode.CATEGORIA_NO_ENCONTRADA));

        Producto producto = Producto.builder()
                .nombre(request.getNombre())
                .descripcion(request.getDescripcion())
                .precio(request.getPrecio())
                .categoria(categoria)
                .activo(request.getActivo())
                .build();

        return ResponseEntity.ok(
                ApiResponse.ok("Producto actualizado correctamente", productoService.actualizar(id, producto))
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        productoService.eliminar(id);
        return ResponseEntity.ok(
                ApiResponse.ok("Producto eliminado correctamente", null)
        );
    }
}