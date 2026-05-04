package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.reportes.ResumenPlatillosDiario;
import com.pagoda.pagoda_api.service.ResumenPlatillosDiarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reportes/platillos")    // ← cambiado de "platillos-diarios"
@RequiredArgsConstructor
public class ResumenPlatillosDiarioController {

    private final ResumenPlatillosDiarioService service;

    @GetMapping("/jornada/{jornadaId}")
    public ResponseEntity<ApiResponse<List<ResumenPlatillosDiario>>> listar(@PathVariable Integer jornadaId) {
        return ResponseEntity.ok(ApiResponse.ok("Resumen de platillos obtenido", service.listarPorJornada(jornadaId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ResumenPlatillosDiario>> crear(@RequestBody ResumenPlatillosDiario payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Resumen de platillos generado", service.guardar(payload)));
    }

    // ✅ NUEVO ENDPOINT para Top 5
    @GetMapping("/top5")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> top5(
            @RequestParam("inicio") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam("fin") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin) {

        List<Map<String, Object>> response = service.obtenerTop5Resumen(inicio, fin);
        return ResponseEntity.ok(ApiResponse.ok("Top 5 de platillos obtenido", response));
    }
}
