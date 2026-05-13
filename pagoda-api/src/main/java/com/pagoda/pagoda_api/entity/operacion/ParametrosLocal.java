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

    @Builder.Default
    @Column(name = "fondo_lunes", nullable = false)
    private BigDecimal fondoLunes = new BigDecimal("2000");

    @Builder.Default
    @Column(name = "fondo_martes", nullable = false)
    private BigDecimal fondoMartes = new BigDecimal("2000");

    @Builder.Default
    @Column(name = "fondo_miercoles", nullable = false)
    private BigDecimal fondoMiercoles = new BigDecimal("2000");

    @Builder.Default
    @Column(name = "fondo_jueves", nullable = false)
    private BigDecimal fondoJueves = new BigDecimal("5000");

    @Builder.Default
    @Column(name = "fondo_viernes", nullable = false)
    private BigDecimal fondoViernes = new BigDecimal("5000");

    @Builder.Default
    @Column(name = "fondo_sabado", nullable = false)
    private BigDecimal fondoSabado = new BigDecimal("5000");

    @Builder.Default
    @Column(name = "fondo_domingo", nullable = false)
    private BigDecimal fondoDomingo = new BigDecimal("5000");

    @Builder.Default
    @Column(name = "comision_bancaria", nullable = false)
    private BigDecimal comisionBancaria = new BigDecimal("3.5");

    @Builder.Default
    @Column(name = "rol_por_defecto", nullable = false)
    private String rolPorDefecto = "MESERO";

    @Builder.Default
    @Column(name = "auto_logout_minutos", nullable = false)
    private Integer autoLogoutMinutos = 30;

    @Builder.Default
    @Column(name = "impresora_tickets", nullable = false)
    private String impresoraTickets = "default";

    @Builder.Default
    @Column(name = "imprimir_resumen_cierre", nullable = false)
    private Boolean imprimirResumenCierre = true;

    @Builder.Default
    @Column(name = "encabezado_ticket", nullable = false)
    private String encabezadoTicket = "Restaurante Asiático";

    @Builder.Default
    @Column(name = "pie_ticket", nullable = false)
    private String pieTicket = "¡Gracias por su visita!";

    @ManyToOne
    @JoinColumn(name = "actualizado_por")
    private Usuario actualizadoPor;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;
}
