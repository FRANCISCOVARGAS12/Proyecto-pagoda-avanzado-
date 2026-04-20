package com.pagoda.pagoda_api.entity.ventas;

import com.pagoda.pagoda_api.entity.catalogos.MetodoPago;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "pagos", schema = "ventas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "venta_id", nullable = false)
    private Venta venta;

    @Column(name = "numero_comensal")
    private Integer numeroComensal;

    @ManyToOne
    @JoinColumn(name = "metodo_pago_id", nullable = false)
    private MetodoPago metodoPago;

    @Column(nullable = false)
    private BigDecimal monto;

    @Column(name = "comision_porcentaje")
    private BigDecimal comisionPorcentaje = BigDecimal.ZERO;

    @Column(name = "monto_neto", nullable = false)
    private BigDecimal montoNeto;

    @Column(name = "propina_monto")
    private BigDecimal propinaMonto = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "propina_metodo_pago_id")
    private MetodoPago propinaMetodoPago;

    @Column(name = "propina_neto")
    private BigDecimal propinaNeto = BigDecimal.ZERO;
}