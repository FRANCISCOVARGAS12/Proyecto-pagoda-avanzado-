package com.pagoda.pagoda_api.repository.ventas;

import com.pagoda.pagoda_api.entity.ventas.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Integer> {
    List<Pago> findByVentaId(Integer ventaId);

    @Query(value = """
            SELECT COALESCE(SUM(
                CASE
                    WHEN COALESCE(p.propina_neto, 0) > 0 THEN p.propina_neto
                    ELSE COALESCE(p.propina_monto, 0)
                END
            ), 0)
            FROM ventas.pagos p
            JOIN ventas.ventas v ON p.venta_id = v.id
            LEFT JOIN operacion.jornadas j ON v.jornada_id = j.id
            WHERE COALESCE(
                CAST(v.fecha_cierre AS date),
                CAST(v.fecha_creacion AS date),
                CASE
                    WHEN j.hora_apertura IS NOT NULL
                      AND CAST(j.hora_apertura AS time) < TIME '06:00:00'
                      AND j.fecha = CAST(j.hora_apertura AS date)
                    THEN CAST(j.fecha - INTERVAL '1 day' AS date)
                    ELSE j.fecha
                END
            ) BETWEEN :inicio AND :fin
            """, nativeQuery = true)
    BigDecimal sumPropinasNetasByRango(@Param("inicio") LocalDate inicio,
                                       @Param("fin") LocalDate fin);
}
