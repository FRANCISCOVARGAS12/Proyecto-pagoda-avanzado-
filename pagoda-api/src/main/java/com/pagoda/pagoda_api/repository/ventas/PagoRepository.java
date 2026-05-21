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

    @Query(value = """
            WITH pagos_fecha AS (
                SELECT
                    COALESCE((
                        CASE
                            WHEN j.hora_apertura IS NOT NULL
                              AND CAST(j.hora_apertura AS time) < TIME '06:00:00'
                              AND j.fecha = CAST(j.hora_apertura AS date)
                            THEN CAST(j.fecha - INTERVAL '1 day' AS date)
                            ELSE j.fecha
                        END
                    ), CAST(v.fecha_cierre AS date), CAST(v.fecha_creacion AS date)) AS fecha,
                    v.id AS venta_id,
                    COALESCE(p.monto_neto, p.monto, 0) AS monto_neto
                FROM ventas.pagos p
                JOIN ventas.ventas v ON p.venta_id = v.id
                LEFT JOIN operacion.jornadas j ON v.jornada_id = j.id
                WHERE v.fecha_cierre IS NOT NULL
            )
            SELECT
                fecha,
                COUNT(DISTINCT venta_id),
                COALESCE(SUM(monto_neto), 0)
            FROM pagos_fecha
            WHERE fecha BETWEEN :inicio AND :fin
            GROUP BY fecha
            ORDER BY fecha
            """, nativeQuery = true)
    List<Object[]> findFlujoVentasNetasByRango(@Param("inicio") LocalDate inicio,
                                               @Param("fin") LocalDate fin);

    @Query(value = """
            WITH params AS (
                SELECT COALESCE(MAX(comision_bancaria), 0) AS comision_bancaria
                FROM operacion.parametros_local
            ),
            pagos_propina AS (
                SELECT
                    v.id AS folio,
                    COALESCE((
                        CASE
                            WHEN j.hora_apertura IS NOT NULL
                              AND CAST(j.hora_apertura AS time) < TIME '06:00:00'
                              AND j.fecha = CAST(j.hora_apertura AS date)
                            THEN CAST(j.fecha - INTERVAL '1 day' AS date)
                            ELSE j.fecha
                        END
                    ), CAST(v.fecha_cierre AS date), CAST(v.fecha_creacion AS date)) AS fecha,
                    m.numero AS mesa,
                    COALESCE(p.propina_monto, 0) AS propina_monto,
                    LOWER(COALESCE(mp_propina.nombre, mp_pago.nombre, '')) AS metodo_propina,
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
                        ELSE COALESCE(p.propina_monto, 0)
                    END AS propina_neta
                FROM ventas.pagos p
                JOIN ventas.ventas v ON p.venta_id = v.id
                LEFT JOIN operacion.mesas m ON v.mesa_id = m.id
                LEFT JOIN catalogos.metodos_pago mp_pago ON mp_pago.id = p.metodo_pago_id
                LEFT JOIN catalogos.metodos_pago mp_propina ON mp_propina.id = p.propina_metodo_pago_id
                LEFT JOIN operacion.jornadas j ON v.jornada_id = j.id
                CROSS JOIN params
                WHERE v.fecha_cierre IS NOT NULL
            )
            SELECT
                folio,
                fecha,
                mesa,
                SUM(CASE WHEN metodo_propina LIKE '%tarjeta%' THEN 0 ELSE propina_monto END) AS propina_efectivo,
                SUM(CASE WHEN metodo_propina LIKE '%tarjeta%' THEN propina_monto ELSE 0 END) AS propina_tarjeta_bruto,
                SUM(CASE WHEN metodo_propina LIKE '%tarjeta%' THEN propina_neta ELSE 0 END) AS propina_tarjeta_neto,
                SUM(CASE WHEN metodo_propina LIKE '%tarjeta%' THEN propina_neta ELSE propina_monto END) AS total_neto
            FROM pagos_propina
            WHERE fecha BETWEEN :inicio AND :fin
              AND propina_monto > 0
            GROUP BY folio, fecha, mesa
            ORDER BY fecha DESC, folio DESC
            """, nativeQuery = true)
    List<Object[]> findDetallePropinasByRango(@Param("inicio") LocalDate inicio,
                                              @Param("fin") LocalDate fin);
}
