package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.dto.response.LoginResponse;
import com.pagoda.pagoda_api.entity.catalogos.Rol;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.RolRepository;
import com.pagoda.pagoda_api.repository.operacion.UsuarioRepository;
import com.pagoda.pagoda_api.service.AdminAuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.Data;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuthService adminAuthService;

    @Data
    public static class RegisterFirstAdminRequest {
        @NotBlank(message = "El nombre es obligatorio")
        private String nombre;

        @NotBlank(message = "El PIN es obligatorio")
        @Pattern(regexp = "^\\d{6}$", message = "El PIN debe tener exactamente 6 dígitos")
        private String pin;
    }

    @GetMapping("/check-setup")
    public ResponseEntity<ApiResponse<Boolean>> checkSetup() {
        boolean hasAdmin = usuarioRepository.findAll().stream()
                .anyMatch(u -> u.getRol() != null && "ADMIN".equalsIgnoreCase(u.getRol().getNombre()) && u.getActivo());
        return ResponseEntity.ok(ApiResponse.ok("Setup check", !hasAdmin));
    }

    @PostMapping("/register-first-admin")
    public ResponseEntity<ApiResponse<LoginResponse>> registerFirstAdmin(@Valid @RequestBody RegisterFirstAdminRequest request) {
        boolean hasAdmin = usuarioRepository.findAll().stream()
                .anyMatch(u -> u.getRol() != null && "ADMIN".equalsIgnoreCase(u.getRol().getNombre()) && u.getActivo());
        if (hasAdmin) {
            throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
        }

        Rol adminRol = rolRepository.findByNombre("ADMIN")
                .orElseThrow(() -> new PagodaException(ErrorCode.ROL_NO_ENCONTRADO));

        if (usuarioRepository.existsByNombre(request.getNombre())) {
            throw new PagodaException(ErrorCode.NOMBRE_USUARIO_DUPLICADO);
        }

        Usuario admin = Usuario.builder()
                .nombre(request.getNombre().trim())
                .rol(adminRol)
                .pinHash(passwordEncoder.encode(request.getPin()))
                .activo(true)
                .build();

        usuarioRepository.save(admin);
        LoginResponse loginResponse = adminAuthService.loginConPin(request.getNombre(), request.getPin());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Admin registrado correctamente", loginResponse));
    }
}
