package com.pagoda.pagoda_api.entity.reportes;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.ventas.Venta;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "resumen_propinas_diario", schema = "reportes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumenPropinaDiario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "jornada_id", nullable = false)
    private Jornada jornada;

    @ManyToOne
    @JoinColumn(name = "venta_id", nullable = false)
    private Venta venta;

    @Column(name = "propinas_efectivo", nullable = false)
    private BigDecimal propinasEfectivo = BigDecimal.ZERO;

    @Column(name = "propinas_tarjeta_bruto", nullable = false)
    private BigDecimal propinasTarjetaBruto = BigDecimal.ZERO;

    @Column(name = "propinas_tarjeta_neto", nullable = false)
    private BigDecimal propinasTarjetaNeto = BigDecimal.ZERO;

    @Column(name = "total_propinas_neto", nullable = false)
    private BigDecimal totalPropinasNeto = BigDecimal.ZERO;

    @Column(name = "fecha_generacion")
    private LocalDateTime fechaGeneracion;
}