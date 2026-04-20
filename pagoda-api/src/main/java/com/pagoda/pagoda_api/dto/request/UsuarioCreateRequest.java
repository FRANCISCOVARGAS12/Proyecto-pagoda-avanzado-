package com.pagoda.pagoda_api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
    @Size(min = 4, max = 8, message = "El PIN debe tener entre 4 y 8 caracteres")
    private String pin;
}


