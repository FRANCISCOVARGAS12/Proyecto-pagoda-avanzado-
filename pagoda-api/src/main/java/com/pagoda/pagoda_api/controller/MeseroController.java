package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.request.MeseroLoginPinRequest;
import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.dto.response.LoginResponse;
import com.pagoda.pagoda_api.service.AdminAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mesero")
@RequiredArgsConstructor
public class MeseroController {

    private final AdminAuthService adminAuthService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody MeseroLoginPinRequest request) {
        LoginResponse response = adminAuthService.loginMeseroConPin(request.getPin());
        return ResponseEntity.ok(ApiResponse.ok("Login exitoso", response));
    }
}
