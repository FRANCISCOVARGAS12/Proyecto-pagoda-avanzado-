package com.pagoda.pagoda_api.entity.reportes;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.ventas.Venta;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "resumen_ventas_diario", schema = "reportes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumenVentasDiario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "jornada_id", nullable = false)
    private Jornada jornada;

    @ManyToOne
    @JoinColumn(name = "venta_id", nullable = false)
    private Venta venta;

    @Column(name = "total_ventas", nullable = false)
    private BigDecimal totalVentas = BigDecimal.ZERO;

    @Column(name = "total_efectivo", nullable = false)
    private BigDecimal totalEfectivo = BigDecimal.ZERO;

    @Column(name = "total_tarjeta_bruto", nullable = false)
    private BigDecimal totalTarjetaBruto = BigDecimal.ZERO;

    @Column(name = "total_tarjeta_neto", nullable = false)
    private BigDecimal totalTarjetaNeto = BigDecimal.ZERO;

    @Column(name = "total_transacciones", nullable = false)
    private Integer totalTransacciones = 0;

    @Column(name = "fecha_generacion")
    private LocalDateTime fechaGeneracion;
}