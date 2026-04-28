package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import com.pagoda.pagoda_api.service.ResumenPropinaDiarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reportes/propinas-diarias")
@RequiredArgsConstructor
public class ResumenPropinaDiarioController {

    private final ResumenPropinaDiarioService service;

    @GetMapping("/jornada/{jornadaId}")
    public ResponseEntity<ApiResponse<List<ResumenPropinaDiario>>> listar(@PathVariable Integer jornadaId) {
        return ResponseEntity.ok(ApiResponse.ok("Resumen de propinas obtenido", service.listarPorJornada(jornadaId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ResumenPropinaDiario>> crear(@RequestBody ResumenPropinaDiario payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Resumen de propinas generado", service.guardar(payload)));
    }

    @GetMapping("/quincena")
    public ResponseEntity<ApiResponse<Map<String, Object>>> obtenerQuincena() {
        BigDecimal propinasQuincena = service.obtenerPropinasPorQuincena();
        Map<String, Object> response = Map.of(
                "propinasQuincena", propinasQuincena,
                "moneda", "MXN"
        );
        return ResponseEntity.ok(ApiResponse.ok("Propinas de la quincena obtenidas", response));
    }
}

