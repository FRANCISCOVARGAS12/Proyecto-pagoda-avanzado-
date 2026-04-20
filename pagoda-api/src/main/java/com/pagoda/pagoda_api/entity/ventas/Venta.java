package com.pagoda.pagoda_api.entity.ventas;

import com.pagoda.pagoda_api.entity.catalogos.TipoCobro;
import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.operacion.Mesa;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ventas", schema = "ventas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Venta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "mesa_id", nullable = false)
    private Mesa mesa;

    @ManyToOne
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "jornada_id", nullable = false)
    private Jornada jornada;

    @Column(name = "num_comensales", nullable = false)
    private Integer numComensales;

    @ManyToOne
    @JoinColumn(name = "tipo_cobro_id", nullable = false)
    private TipoCobro tipoCobro;

    @Column(name = "total_cuenta", nullable = false)
    private BigDecimal totalCuenta = BigDecimal.ZERO;

    @Column(name = "comision_porcentaje")
    private BigDecimal comisionPorcentaje = new BigDecimal("3.5");

    @Column(name = "fecha_creacion")
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_cierre")
    private LocalDateTime fechaCierre;
}