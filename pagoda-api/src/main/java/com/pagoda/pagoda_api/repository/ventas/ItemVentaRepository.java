package com.pagoda.pagoda_api.repository.ventas;

import com.pagoda.pagoda_api.entity.ventas.ItemVenta;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ItemVentaRepository extends JpaRepository<ItemVenta, Integer> {
    List<ItemVenta> findByVentaId(Integer ventaId);

    @Query("""
            SELECT i.producto.nombre,
                   i.producto.categoria.nombre,
                   SUM(i.cantidad),
                   SUM(i.precioUnitario * i.cantidad)
            FROM ItemVenta i
            WHERE i.venta.jornada.fecha BETWEEN :inicio AND :fin
              AND i.venta.fechaCierre IS NOT NULL
            GROUP BY i.producto.nombre, i.producto.categoria.nombre
            ORDER BY SUM(i.precioUnitario * i.cantidad) DESC
            """)
    List<Object[]> findTop5ByRango(@Param("inicio") LocalDate inicio,
                                   @Param("fin") LocalDate fin,
                                   Pageable pageable);
}
