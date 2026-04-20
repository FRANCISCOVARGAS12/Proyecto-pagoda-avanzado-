package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.reportes.ResumenVentasDiario;
import com.pagoda.pagoda_api.service.ResumenVentasDiarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reportes/ventas-diarias")
@RequiredArgsConstructor
public class ResumenVentasDiarioController {

    private final ResumenVentasDiarioService service;

    @GetMapping("/jornada/{jornadaId}")
    public ResponseEntity<ApiResponse<List<ResumenVentasDiario>>> listar(@PathVariable Integer jornadaId) {
        return ResponseEntity.ok(ApiResponse.ok("Resumen de ventas obtenido", service.listarPorJornada(jornadaId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ResumenVentasDiario>> crear(@RequestBody ResumenVentasDiario payload) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Resumen de ventas generado", service.guardar(payload)));
    }
}

