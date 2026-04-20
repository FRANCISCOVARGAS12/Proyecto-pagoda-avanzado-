package com.pagoda.pagoda_api.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UsuarioResponse {
    private Integer id;
    private String nombre;
    private String rol;
    private Boolean activo;
}

