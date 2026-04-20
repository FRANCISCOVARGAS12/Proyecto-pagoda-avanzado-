package com.pagoda.pagoda_api.entity.catalogos;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "metodos_pago", schema = "catalogos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MetodoPago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String nombre;
}