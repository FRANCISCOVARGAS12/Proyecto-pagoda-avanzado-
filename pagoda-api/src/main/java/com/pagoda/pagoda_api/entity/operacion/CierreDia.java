package com.pagoda.pagoda_api.entity.operacion;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "cierre_dia", schema = "operacion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CierreDia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne
    @JoinColumn(name = "jornada_id", nullable = false)
    private Jornada jornada;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(name = "saldo_inicial", nullable = false)
    private BigDecimal saldoInicial;

    @Column(nullable = false)
    private BigDecimal ventas = BigDecimal.ZERO;

    @Column(name = "saldo_final", nullable = false)
    private BigDecimal saldoFinal = BigDecimal.ZERO;

    @Column(name = "num_pedidos_despachados", nullable = false)
    private Integer numPedidosDespachados = 0;

    @Column(name = "volumen_ventas_cantidad", nullable = false)
    private Integer volumenVentasCantidad = 0;

    @Column(name = "volumen_ventas_efectivo", nullable = false)
    private BigDecimal volumenVentasEfectivo = BigDecimal.ZERO;

    @Column(name = "volumen_ventas_tarjeta", nullable = false)
    private BigDecimal volumenVentasTarjeta = BigDecimal.ZERO;

    @Column(name = "fecha_generacion")
    private LocalDateTime fechaGeneracion;
}