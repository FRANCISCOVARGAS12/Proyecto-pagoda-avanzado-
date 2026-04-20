package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.ventas.Venta;
import com.pagoda.pagoda_api.service.VentaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ventas")
@RequiredArgsConstructor
public class VentaController {

    private final VentaService ventaService;

    @GetMapping("/activas")
    public ResponseEntity<ApiResponse<List<Venta>>> listarActivas() {
        return ResponseEntity.ok(ApiResponse.ok("Ventas en curso obtenidas", ventaService.listarActivas()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Venta>> obtenerPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Venta obtenida", ventaService.obtenerPorId(id)));
    }

    @PostMapping("/abrir")
    public ResponseEntity<ApiResponse<Venta>> abrir(@RequestBody Venta venta) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Venta abierta con exito", ventaService.abrir(venta)));
    }

    @PutMapping("/{id}/cerrar")
    public ResponseEntity<ApiResponse<Venta>> cerrar(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Venta cerrada correctamente", ventaService.cerrar(id)));
    }
}

