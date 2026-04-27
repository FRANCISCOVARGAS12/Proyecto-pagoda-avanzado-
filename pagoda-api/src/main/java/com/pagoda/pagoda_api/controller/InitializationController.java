package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.service.InitializationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/initialize")
@RequiredArgsConstructor
public class InitializationController {

    private final InitializationService initService;

    @PostMapping
    public ResponseEntity<ApiResponse<String>> initialize() {
        String result = initService.cleanAndInitializeData();
        return ResponseEntity.ok(ApiResponse.ok(result, null));
    }
}
