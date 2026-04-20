package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import com.pagoda.pagoda_api.service.ParametrosLocalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/operacion/parametros")
@RequiredArgsConstructor
public class ParametrosLocalController {

    private final ParametrosLocalService parametrosLocalService;

    @GetMapping
    public ResponseEntity<ApiResponse<ParametrosLocal>> obtener() {
        return ResponseEntity.ok(ApiResponse.ok("Parametros obtenidos correctamente", parametrosLocalService.obtener()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ParametrosLocal>> guardar(@RequestBody ParametrosLocal payload) {
        return ResponseEntity.ok(ApiResponse.ok("Parametros guardados correctamente", parametrosLocalService.guardar(payload)));
    }
}

