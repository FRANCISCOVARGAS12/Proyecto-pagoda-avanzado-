package com.pagoda.pagoda_api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MeseroLoginPinRequest {
    @NotBlank(message = "El PIN es obligatorio")
    @Pattern(regexp = "^\\d{6}$", message = "El PIN debe contener exactamente 6 dígitos")
    private String pin;
}
