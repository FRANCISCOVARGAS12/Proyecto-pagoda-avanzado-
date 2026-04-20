package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.service.JornadaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operacion/jornadas")
@RequiredArgsConstructor
public class JornadaController {

    private final JornadaService jornadaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Jornada>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Historial de jornadas obtenido", jornadaService.listarTodas()));
    }

    @GetMapping("/estado")
    public ResponseEntity<ApiResponse<Jornada>> estado() {
        return jornadaService.obtenerJornadaAbierta()
                .map(j -> ResponseEntity.ok(ApiResponse.ok("Hay una jornada activa", j)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("No hay una jornada activa", 4040)));
    }

    @PostMapping("/abrir")
    public ResponseEntity<ApiResponse<Jornada>> abrir(@RequestBody Jornada jornada) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Jornada abierta correctamente", jornadaService.abrirJornada(jornada)));
    }

    @PutMapping("/cerrar/{id}")
    public ResponseEntity<ApiResponse<Jornada>> cerrar(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Jornada cerrada correctamente", jornadaService.cerrarJornada(id)));
    }
}

