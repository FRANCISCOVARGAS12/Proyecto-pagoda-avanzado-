package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import com.pagoda.pagoda_api.service.ResumenPropinaDiarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reportes/propinas")
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

    // ✅ Periodo actual de 15 días (móvil)
    @GetMapping("/actual")
    public ResponseEntity<ApiResponse<Map<String, Object>>> obtenerPeriodoActual() {
        ResumenPropinaDiarioService.PropinasPeriodo periodo = service.resolveCurrentPeriod();
        LocalDate inicio = periodo.inicio();
        LocalDate fin = periodo.fin();
        BigDecimal acumulado = service.getTotalPropinaEntreFechas(inicio, fin);

        Map<String, Object> data = new HashMap<>();
        data.put("inicio", inicio.toString());
        data.put("fin", fin.toString());
        data.put("acumulado", acumulado);
        return ResponseEntity.ok(ApiResponse.ok("Propinas del periodo actual", data));
    }

    // ✅ Rango personalizado (llamado por el frontend al cambiar fechas)
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> obtenerRango(
            @RequestParam("inicio") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam("fin") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin) {

        BigDecimal acumulado = service.getTotalPropinaEntreFechas(inicio, fin);
        Map<String, Object> data = new HashMap<>();
        data.put("inicio", inicio.toString());
        data.put("fin", fin.toString());
        data.put("acumulado", acumulado);
        return ResponseEntity.ok(ApiResponse.ok("Propinas en el rango seleccionado", data));
    }
}
