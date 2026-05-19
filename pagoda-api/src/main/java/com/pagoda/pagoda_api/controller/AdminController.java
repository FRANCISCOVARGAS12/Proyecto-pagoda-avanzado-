package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.request.LoginPinRequest;
import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.dto.response.LoginResponse;
import com.pagoda.pagoda_api.dto.response.UsuarioResponse;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.service.AdminAuthService;
import com.pagoda.pagoda_api.service.SuperuserAuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final String SUPERUSER_HEADER = "X-Superuser-Token";

    private final AdminAuthService adminAuthService;
    private final SuperuserAuthService superuserAuthService;

    @Data
    public static class SuperuserPasswordRequest {
        @NotBlank(message = "La contrasena de superusuario es obligatoria")
        @Size(min = 8, message = "La contrasena de superusuario debe tener al menos 8 caracteres")
        private String password;
    }

    @Data
    public static class VerifyPinRequest {
        @NotBlank(message = "El PIN es obligatorio")
        @Pattern(regexp = "^\\d{6}$", message = "El PIN debe tener exactamente 6 digitos")
        private String pin;
    }

    @GetMapping("/superuser/status")
    public ResponseEntity<ApiResponse<Boolean>> superuserStatus() {
        return ResponseEntity.ok(ApiResponse.ok(
                "Estado de superusuario obtenido",
                superuserAuthService.estaConfigurado()
        ));
    }

    @PostMapping("/superuser/setup")
    public ResponseEntity<ApiResponse<SuperuserAuthService.SuperuserSession>> setupSuperuser(
            @Valid @RequestBody SuperuserPasswordRequest request) {
        SuperuserAuthService.SuperuserSession session = superuserAuthService.configurar(request.getPassword());
        return ResponseEntity.ok(ApiResponse.ok("Superusuario configurado", session));
    }

    @PostMapping("/superuser/verify")
    public ResponseEntity<ApiResponse<SuperuserAuthService.SuperuserSession>> verifySuperuser(
            @Valid @RequestBody SuperuserPasswordRequest request) {
        SuperuserAuthService.SuperuserSession session = superuserAuthService.crearSesion(request.getPassword());
        return ResponseEntity.ok(ApiResponse.ok("Superusuario verificado", session));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @RequestHeader(value = SUPERUSER_HEADER, required = false) String superuserToken,
            @Valid @RequestBody LoginPinRequest request) {
        superuserAuthService.validarToken(superuserToken);
        LoginResponse response = adminAuthService.loginConPin(request.getNombre(), request.getPin());
        return ResponseEntity.ok(ApiResponse.ok("Login exitoso", response));
    }

    @PostMapping("/verify-pin")
    public ResponseEntity<ApiResponse<Boolean>> verifyPin(
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody VerifyPinRequest request) {
        String token = authorization.startsWith("Bearer ")
                ? authorization.substring(7).trim()
                : authorization;
        adminAuthService.verificarPinAdmin(token, request.getPin());
        return ResponseEntity.ok(ApiResponse.ok("PIN verificado", true));
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
