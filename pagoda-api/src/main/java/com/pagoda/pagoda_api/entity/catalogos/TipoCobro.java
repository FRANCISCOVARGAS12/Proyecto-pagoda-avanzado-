package com.pagoda.pagoda_api.entity.catalogos;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tipos_cobro", schema = "catalogos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TipoCobro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String nombre;
}