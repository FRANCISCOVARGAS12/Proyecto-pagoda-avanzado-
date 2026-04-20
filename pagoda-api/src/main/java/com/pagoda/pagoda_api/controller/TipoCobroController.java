package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.TipoCobro;
import com.pagoda.pagoda_api.service.TipoCobroService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalogos/tipos-cobro")
@RequiredArgsConstructor
public class TipoCobroController {

    private final TipoCobroService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TipoCobro>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Tipos de cobro obtenidos correctamente", service.listar()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TipoCobro>> obtener(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Tipo de cobro obtenido correctamente", service.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TipoCobro>> crear(@RequestBody TipoCobro payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tipo de cobro creado correctamente", service.crear(payload)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TipoCobro>> actualizar(@PathVariable Integer id, @RequestBody TipoCobro payload) {
        return ResponseEntity.ok(ApiResponse.ok("Tipo de cobro actualizado correctamente", service.actualizar(id, payload)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Tipo de cobro eliminado correctamente", null));
    }
}

