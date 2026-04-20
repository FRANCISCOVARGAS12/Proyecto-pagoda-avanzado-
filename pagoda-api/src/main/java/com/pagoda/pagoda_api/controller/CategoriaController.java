package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.Categoria;
import com.pagoda.pagoda_api.service.CategoriaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaService categoriaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Categoria>>> obtenerTodas() {
        return ResponseEntity.ok(
                ApiResponse.ok("Categorías obtenidas correctamente", categoriaService.obtenerTodas())
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Categoria>> obtenerPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ApiResponse.ok("Categoria obtenida correctamente", categoriaService.obtenerPorId(id))
        );
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Categoria>> crear(@RequestBody Categoria categoria) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Categoria creada correctamente", categoriaService.crear(categoria)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Categoria>> actualizar(@PathVariable Integer id, @RequestBody Categoria categoria) {
        return ResponseEntity.ok(
                ApiResponse.ok("Categoria actualizada correctamente", categoriaService.actualizar(id, categoria))
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        categoriaService.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Categoria eliminada correctamente", null));
    }
}