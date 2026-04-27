package com.pagoda.pagoda_api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UsuarioUpdateRequest {
    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotNull(message = "El rol es obligatorio")
    private Integer rolId;

    @Pattern(regexp = "^\\d{6}$", message = "El PIN debe tener exactamente 6 dígitos")
    private String pin;

    @NotNull(message = "El estado activo es obligatorio")
    private Boolean activo;
}

