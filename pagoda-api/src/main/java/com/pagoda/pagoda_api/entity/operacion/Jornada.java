package com.pagoda.pagoda_api.entity.operacion;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "jornadas", schema = "operacion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Jornada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(name = "fondo_caja", nullable = false)
    private BigDecimal fondoCaja = BigDecimal.ZERO;

    @Column(name = "hora_apertura", nullable = false)
    private LocalDateTime horaApertura;

    @Column(name = "hora_cierre")
    private LocalDateTime horaCierre;

    @Column(nullable = false)
    private String estado = "ABIERTA";

    @ManyToOne
    @JoinColumn(name = "usuario_apertura_id")
    private Usuario usuarioApertura;

    @ManyToOne
    @JoinColumn(name = "usuario_cierre_id")
    private Usuario usuarioCierre;
}