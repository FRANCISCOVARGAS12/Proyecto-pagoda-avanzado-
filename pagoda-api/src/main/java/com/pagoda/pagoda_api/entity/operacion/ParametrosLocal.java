package com.pagoda.pagoda_api.entity.operacion;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "parametros_local", schema = "operacion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParametrosLocal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "fondo_lunes", nullable = false)
    private BigDecimal fondoLunes = new BigDecimal("2000");

    @Column(name = "fondo_martes", nullable = false)
    private BigDecimal fondoMartes = new BigDecimal("2000");

    @Column(name = "fondo_miercoles", nullable = false)
    private BigDecimal fondoMiercoles = new BigDecimal("2000");

    @Column(name = "fondo_jueves", nullable = false)
    private BigDecimal fondoJueves = new BigDecimal("5000");

    @Column(name = "fondo_viernes", nullable = false)
    private BigDecimal fondoViernes = new BigDecimal("5000");

    @Column(name = "fondo_sabado", nullable = false)
    private BigDecimal fondoSabado = new BigDecimal("5000");

    @Column(name = "fondo_domingo", nullable = false)
    private BigDecimal fondoDomingo = new BigDecimal("5000");

    @Column(name = "comision_bancaria", nullable = false)
    private BigDecimal comisionBancaria = new BigDecimal("3.5");

    @ManyToOne
    @JoinColumn(name = "actualizado_por")
    private Usuario actualizadoPor;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;
}