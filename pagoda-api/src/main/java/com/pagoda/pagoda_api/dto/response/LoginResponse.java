package com.pagoda.pagoda_api.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {
    private Integer usuarioId;
    private String nombre;
    private String rol;
    private String token;
}

