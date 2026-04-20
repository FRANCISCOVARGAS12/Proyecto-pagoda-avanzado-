package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.ventas.ItemVenta;
import com.pagoda.pagoda_api.service.ItemVentaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ventas/items")
@RequiredArgsConstructor
public class ItemVentaController {

    private final ItemVentaService itemVentaService;

    @GetMapping("/venta/{ventaId}")
    public ResponseEntity<ApiResponse<List<ItemVenta>>> listarPorVenta(@PathVariable Integer ventaId) {
        return ResponseEntity.ok(ApiResponse.ok("Items obtenidos correctamente", itemVentaService.listarPorVenta(ventaId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ItemVenta>> crear(@RequestBody ItemVenta itemVenta) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Item creado correctamente", itemVentaService.crear(itemVenta)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        itemVentaService.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Item eliminado correctamente", null));
    }
}

