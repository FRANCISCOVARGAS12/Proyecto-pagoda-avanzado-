package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.EstadoItem;
import com.pagoda.pagoda_api.service.EstadoItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalogos/estados-item")
@RequiredArgsConstructor
public class EstadoItemController {

    private final EstadoItemService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EstadoItem>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Estados de item obtenidos correctamente", service.listar()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EstadoItem>> obtener(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Estado de item obtenido correctamente", service.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EstadoItem>> crear(@RequestBody EstadoItem payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Estado de item creado correctamente", service.crear(payload)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EstadoItem>> actualizar(@PathVariable Integer id, @RequestBody EstadoItem payload) {
        return ResponseEntity.ok(ApiResponse.ok("Estado de item actualizado correctamente", service.actualizar(id, payload)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Estado de item eliminado correctamente", null));
    }
}

