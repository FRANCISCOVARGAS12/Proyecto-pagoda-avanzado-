package com.pagoda.pagoda_api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UsuarioCreateRequest {
    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotNull(message = "El rol es obligatorio")
    private Integer rolId;

    @NotBlank(message = "El PIN es obligatorio")
    @Pattern(regexp = "^\\d{6}$", message = "El PIN debe tener exactamente 6 dígitos")
    private String pin;
}

