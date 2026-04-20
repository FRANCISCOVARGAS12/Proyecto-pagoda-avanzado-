package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.EstadoMesa;
import com.pagoda.pagoda_api.service.EstadoMesaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalogos/estados-mesa")
@RequiredArgsConstructor
public class EstadoMesaController {

    private final EstadoMesaService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EstadoMesa>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Estados de mesa obtenidos correctamente", service.listar()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EstadoMesa>> obtener(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Estado de mesa obtenido correctamente", service.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EstadoMesa>> crear(@RequestBody EstadoMesa payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Estado de mesa creado correctamente", service.crear(payload)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EstadoMesa>> actualizar(@PathVariable Integer id, @RequestBody EstadoMesa payload) {
        return ResponseEntity.ok(ApiResponse.ok("Estado de mesa actualizado correctamente", service.actualizar(id, payload)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Estado de mesa eliminado correctamente", null));
    }
}

