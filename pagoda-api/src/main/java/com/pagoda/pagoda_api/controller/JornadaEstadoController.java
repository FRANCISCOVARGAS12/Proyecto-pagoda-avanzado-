package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.service.JornadaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jornadas")
@RequiredArgsConstructor
public class JornadaEstadoController {

    private final JornadaService jornadaService;

    @GetMapping("/estado")
    public ResponseEntity<ApiResponse<Jornada>> estado() {
        return jornadaService.obtenerJornadaAbierta()
                .map(j -> ResponseEntity.ok(ApiResponse.ok("Hay una jornada activa", j)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("No hay una jornada activa", 4040)));
    }
}
