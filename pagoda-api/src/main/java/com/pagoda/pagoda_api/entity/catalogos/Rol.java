package com.pagoda.pagoda_api.entity.catalogos;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "roles", schema = "catalogos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Rol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String nombre;

    private String descripcion;
}