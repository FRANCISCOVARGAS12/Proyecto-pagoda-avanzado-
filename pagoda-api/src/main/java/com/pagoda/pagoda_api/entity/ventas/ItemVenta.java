package com.pagoda.pagoda_api.entity.ventas;

import com.pagoda.pagoda_api.entity.catalogos.EstadoItem;
import com.pagoda.pagoda_api.entity.operacion.Producto;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "items_venta", schema = "ventas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemVenta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "venta_id", nullable = false)
    private Venta venta;

    @ManyToOne
    @JoinColumn(name = "producto_id", nullable = false)
    private Producto producto;

    @Column(name = "numero_comensal", nullable = false)
    private Integer numeroComensal;

    @Column(name = "precio_unitario", nullable = false)
    private BigDecimal precioUnitario;

    @Column(nullable = false)
    private Integer cantidad = 1;

    private String notas;

    @ManyToOne
    @JoinColumn(name = "estado_item_id", nullable = false)
    private EstadoItem estadoItem;
}