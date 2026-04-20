package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.entity.catalogos.Rol;
import com.pagoda.pagoda_api.service.RolService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalogos/roles")
@RequiredArgsConstructor
public class RolController {

    private final RolService rolService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Rol>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok("Roles obtenidos correctamente", rolService.listar()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Rol>> obtener(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Rol obtenido correctamente", rolService.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Rol>> crear(@RequestBody Rol rol) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Rol creado correctamente", rolService.crear(rol)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Rol>> actualizar(@PathVariable Integer id, @RequestBody Rol rol) {
        return ResponseEntity.ok(ApiResponse.ok("Rol actualizado correctamente", rolService.actualizar(id, rol)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Integer id) {
        rolService.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Rol eliminado correctamente", null));
    }
}

