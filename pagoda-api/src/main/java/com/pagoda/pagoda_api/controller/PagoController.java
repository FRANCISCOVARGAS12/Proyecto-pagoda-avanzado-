package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.ventas.Pago;
import com.pagoda.pagoda_api.service.PagoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ventas/pagos")
@RequiredArgsConstructor
public class PagoController {

    private final PagoService pagoService;

    @GetMapping("/venta/{ventaId}")
    public ResponseEntity<ApiResponse<List<Pago>>> listarPorVenta(@PathVariable Integer ventaId) {
        return ResponseEntity.ok(ApiResponse.ok("Pagos obtenidos correctamente", pagoService.listarPorVenta(ventaId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Pago>> crear(@RequestBody Pago pago) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Pago registrado correctamente", pagoService.crear(pago)));
    }
}

