package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.MetodoPago;
import com.pagoda.pagoda_api.service.MetodoPagoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalogos/metodos-pago")
@RequiredArgsConstructor
public class MetodoPagoController {

    private final MetodoPagoService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MetodoPago>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Metodos de pago obtenidos correctamente", service.listar()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MetodoPago>> obtener(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Metodo de pago obtenido correctamente", service.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MetodoPago>> crear(@RequestBody MetodoPago payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Metodo de pago creado correctamente", service.crear(payload)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MetodoPago>> actualizar(@PathVariable Integer id, @RequestBody MetodoPago payload) {
        return ResponseEntity.ok(ApiResponse.ok("Metodo de pago actualizado correctamente", service.actualizar(id, payload)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Metodo de pago eliminado correctamente", null));
    }
}

