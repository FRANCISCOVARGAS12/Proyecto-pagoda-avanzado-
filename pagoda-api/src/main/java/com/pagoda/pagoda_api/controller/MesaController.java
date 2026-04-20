package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.operacion.Mesa;
import com.pagoda.pagoda_api.service.MesaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/mesas")
@RequiredArgsConstructor
public class MesaController {

    private final MesaService mesaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Mesa>>> obtenerTodas() {
        return ResponseEntity.ok(
                ApiResponse.ok("Mesas obtenidas correctamente", mesaService.obtenerTodas())
        );
    }

    @GetMapping("/libres")
    public ResponseEntity<ApiResponse<List<Mesa>>> obtenerLibres() {
        return ResponseEntity.ok(
                ApiResponse.ok("Mesas libres obtenidas correctamente", mesaService.obtenerLibres())
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Mesa>> obtenerPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ApiResponse.ok("Mesa obtenida correctamente", mesaService.obtenerPorId(id))
        );
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Mesa>> crear(@RequestBody Mesa mesa) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Mesa creada correctamente", mesaService.guardar(mesa)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Mesa>> actualizar(@PathVariable Integer id, @RequestBody Mesa mesa) {
        return ResponseEntity.ok(
                ApiResponse.ok("Mesa actualizada correctamente", mesaService.actualizar(id, mesa))
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        mesaService.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Mesa eliminada correctamente", null));
    }
}