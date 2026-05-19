package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.ventas.Venta;
import com.pagoda.pagoda_api.entity.ventas.Pago;
import com.pagoda.pagoda_api.service.PagoService;
import com.pagoda.pagoda_api.service.VentaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/ventas")
@RequiredArgsConstructor
public class VentaController {

    private final VentaService ventaService;
    private final PagoService pagoService;

    @Data
    public static class ActualizarPropinaRequest {
        @DecimalMin(value = "0.00", message = "La propina no puede ser negativa")
        private BigDecimal propinaMonto = BigDecimal.ZERO;
    }

    @GetMapping("/activas")
    public ResponseEntity<ApiResponse<List<Venta>>> listarActivas() {
        return ResponseEntity.ok(ApiResponse.ok("Ventas en curso obtenidas", ventaService.listarActivas()));
    }

    @GetMapping("/jornada/{jornadaId}")
    public ResponseEntity<ApiResponse<List<Venta>>> listarPorJornada(@PathVariable Integer jornadaId) {
        return ResponseEntity.ok(ApiResponse.ok("Ventas de la jornada obtenidas", ventaService.listarPorJornada(jornadaId)));
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

    @PutMapping("/{id}/propina")
    public ResponseEntity<ApiResponse<List<Pago>>> actualizarPropina(
            @PathVariable Integer id,
            @Valid @RequestBody ActualizarPropinaRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Propina actualizada correctamente",
                pagoService.actualizarPropinaVenta(id, request.getPropinaMonto())
        ));
    }
}
