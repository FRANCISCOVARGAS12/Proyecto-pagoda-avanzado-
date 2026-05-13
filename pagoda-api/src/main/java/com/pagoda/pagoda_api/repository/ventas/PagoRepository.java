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
                    WHEN COALESCE(p.propina_monto, 0) <= 0 THEN 0
                    WHEN COALESCE(p.propina_neto, 0) > 0
                      AND p.propina_neto < p.propina_monto THEN p.propina_neto
                    WHEN LOWER(COALESCE(mp_propina.nombre, mp_pago.nombre, '')) LIKE '%tarjeta%'
                    THEN ROUND(
                        COALESCE(p.propina_monto, 0)
                        * (1 - (
                            CASE
                                WHEN COALESCE(p.comision_porcentaje, 0) > 0 THEN p.comision_porcentaje
                                ELSE params.comision_bancaria
                            END
                        ) / 100)
                    , 2)
                    ELSE p.propina_monto
                END
            ), 0)
            FROM ventas.pagos p
            JOIN ventas.ventas v ON p.venta_id = v.id
            LEFT JOIN catalogos.metodos_pago mp_pago ON mp_pago.id = p.metodo_pago_id
            LEFT JOIN catalogos.metodos_pago mp_propina ON mp_propina.id = p.propina_metodo_pago_id
            LEFT JOIN operacion.jornadas j ON v.jornada_id = j.id
            CROSS JOIN (
                SELECT COALESCE(MAX(comision_bancaria), 0) AS comision_bancaria
                FROM operacion.parametros_local
            ) params
            WHERE v.fecha_cierre IS NOT NULL
              AND COALESCE((
                CASE
                    WHEN j.hora_apertura IS NOT NULL
                      AND CAST(j.hora_apertura AS time) < TIME '06:00:00'
                      AND j.fecha = CAST(j.hora_apertura AS date)
                    THEN CAST(j.fecha - INTERVAL '1 day' AS date)
                    ELSE j.fecha
                END
            ), CAST(v.fecha_cierre AS date), CAST(v.fecha_creacion AS date)
            ) BETWEEN :inicio AND :fin
            """, nativeQuery = true)
    BigDecimal sumPropinasNetasByRango(@Param("inicio") LocalDate inicio,
                                       @Param("fin") LocalDate fin);
}
