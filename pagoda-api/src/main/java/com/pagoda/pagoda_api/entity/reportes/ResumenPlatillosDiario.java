package com.pagoda.pagoda_api.entity.reportes;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.operacion.Producto;
import com.pagoda.pagoda_api.entity.ventas.Venta;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "resumen_platillos_diario", schema = "reportes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumenPlatillosDiario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "jornada_id", nullable = false)
    private Jornada jornada;

    @ManyToOne
    @JoinColumn(name = "venta_id", nullable = false)
    private Venta venta;

    @ManyToOne
    @JoinColumn(name = "producto_id", nullable = false)
    private Producto producto;

    @Column(name = "cantidad_vendida", nullable = false)
    private Integer cantidadVendida = 0;

    @Column(name = "total_generado", nullable = false)
    private BigDecimal totalGenerado = BigDecimal.ZERO;

    @Column(name = "total_efectivo", nullable = false)
    private BigDecimal totalEfectivo = BigDecimal.ZERO;

    @Column(name = "total_tarjeta_bruto", nullable = false)
    private BigDecimal totalTarjetaBruto = BigDecimal.ZERO;

    @Column(name = "total_tarjeta_neto", nullable = false)
    private BigDecimal totalTarjetaNeto = BigDecimal.ZERO;

    @Column(name = "fecha_generacion")
    private LocalDateTime fechaGeneracion;
}