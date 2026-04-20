package com.pagoda.pagoda_api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UsuarioUpdateRequest {
    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotNull(message = "El rol es obligatorio")
    private Integer rolId;

    @Size(min = 4, max = 8, message = "El PIN debe tener entre 4 y 8 caracteres")
    private String pin;

    @NotNull(message = "El estado activo es obligatorio")
    private Boolean activo;
}


