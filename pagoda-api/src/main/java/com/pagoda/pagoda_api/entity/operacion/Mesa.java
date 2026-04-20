package com.pagoda.pagoda_api.entity.operacion;

import com.pagoda.pagoda_api.entity.catalogos.EstadoMesa;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "mesas", schema = "operacion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Mesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private Integer numero;

    @Column(nullable = false)
    private Integer capacidad;

    @ManyToOne
    @JoinColumn(name = "estado_id", nullable = false)
    private EstadoMesa estado;
}