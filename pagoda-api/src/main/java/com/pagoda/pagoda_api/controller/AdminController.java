package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.request.LoginPinRequest;
import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.dto.response.LoginResponse;
import com.pagoda.pagoda_api.dto.response.UsuarioResponse;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.service.AdminAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAuthService adminAuthService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginPinRequest request) {
        LoginResponse response = adminAuthService.loginConPin(request.getNombre(), request.getPin());
        return ResponseEntity.ok(ApiResponse.ok("Login exitoso", response));
    }

    @GetMapping("/perfil")
    public ResponseEntity<ApiResponse<UsuarioResponse>> perfil(@RequestHeader("Authorization") String authorization) {
        String token = authorization.startsWith("Bearer ")
                ? authorization.substring(7).trim()
                : authorization;

        Usuario admin = adminAuthService.obtenerAdminPorToken(token);
        UsuarioResponse response = UsuarioResponse.builder()
                .id(admin.getId())
                .nombre(admin.getNombre())
                .rol(admin.getRol() == null ? null : admin.getRol().getNombre())
                .activo(admin.getActivo())
                .build();
        return ResponseEntity.ok(ApiResponse.ok("Perfil obtenido", response));
    }
}

