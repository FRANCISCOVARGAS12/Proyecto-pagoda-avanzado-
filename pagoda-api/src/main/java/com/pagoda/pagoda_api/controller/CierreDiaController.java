package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.operacion.CierreDia;
import com.pagoda.pagoda_api.service.CierreDiaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operacion/cierres-dia")
@RequiredArgsConstructor
public class CierreDiaController {

    private final CierreDiaService cierreDiaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CierreDia>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Historial de cierres obtenido", cierreDiaService.listarTodos()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CierreDia>> obtener(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Cierre encontrado", cierreDiaService.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CierreDia>> generar(@RequestBody CierreDia cierreDia) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Cierre generado con exito", cierreDiaService.generar(cierreDia)));
    }
}

