BEGIN;

DO $$
DECLARE
  ventas_faltantes integer;
  ventas_sin_propina_suficiente integer;
BEGIN
  WITH ajustes(venta_id, descuento) AS (
    VALUES
      (73, 200.00::numeric),
      (74, 200.00::numeric),
      (75, 500.00::numeric)
  )
  SELECT COUNT(*)
  INTO ventas_faltantes
  FROM ajustes a
  LEFT JOIN ventas.ventas v ON v.id = a.venta_id
  WHERE v.id IS NULL;

  IF ventas_faltantes > 0 THEN
    RAISE EXCEPTION 'Hay folios del ajuste que no existen. Ejecuta primero fix_preview_propinas_73_74_75.sql.';
  END IF;

  WITH ajustes(venta_id, descuento) AS (
    VALUES
      (73, 200.00::numeric),
      (74, 200.00::numeric),
      (75, 500.00::numeric)
  ),
  totales AS (
    SELECT
      a.venta_id,
      a.descuento,
      COALESCE(SUM(p.propina_monto), 0) AS propina_total
    FROM ajustes a
    LEFT JOIN ventas.pagos p ON p.venta_id = a.venta_id AND COALESCE(p.propina_monto, 0) > 0
    GROUP BY a.venta_id, a.descuento
  )
  SELECT COUNT(*)
  INTO ventas_sin_propina_suficiente
  FROM totales
  WHERE propina_total < descuento;

  IF ventas_sin_propina_suficiente > 0 THEN
    RAISE EXCEPTION 'Uno o mas folios tienen menos propina que el ajuste solicitado.';
  END IF;
END $$;

WITH ajustes(venta_id, descuento) AS (
  VALUES
    (73, 200.00::numeric),
    (74, 200.00::numeric),
    (75, 500.00::numeric)
),
params AS (
  SELECT COALESCE(MAX(comision_bancaria), 0) AS comision_bancaria
  FROM operacion.parametros_local
),
carriers AS (
  SELECT
    p.id AS pago_id,
    p.venta_id,
    p.propina_monto,
    p.comision_porcentaje,
    LOWER(COALESCE(mp_propina.nombre, mp_pago.nombre, '')) AS metodo_propina,
    SUM(p.propina_monto) OVER (PARTITION BY p.venta_id) AS propina_total_actual,
    GREATEST(SUM(p.propina_monto) OVER (PARTITION BY p.venta_id) - a.descuento, 0) AS propina_total_nueva,
    ROW_NUMBER() OVER (PARTITION BY p.venta_id ORDER BY p.id) AS rn,
    COUNT(*) OVER (PARTITION BY p.venta_id) AS carrier_count,
    params.comision_bancaria
  FROM ventas.pagos p
  JOIN ajustes a ON a.venta_id = p.venta_id
  LEFT JOIN catalogos.metodos_pago mp_pago ON mp_pago.id = p.metodo_pago_id
  LEFT JOIN catalogos.metodos_pago mp_propina ON mp_propina.id = p.propina_metodo_pago_id
  CROSS JOIN params
  WHERE COALESCE(p.propina_monto, 0) > 0
),
proporciones AS (
  SELECT
    *,
    CASE
      WHEN rn = carrier_count THEN NULL
      ELSE ROUND(propina_total_nueva * propina_monto / propina_total_actual, 2)
    END AS propina_previa
  FROM carriers
),
calculadas AS (
  SELECT
    *,
    CASE
      WHEN rn = carrier_count THEN
        ROUND(
          propina_total_nueva
          - COALESCE(
              SUM(propina_previa) OVER (
                PARTITION BY venta_id
                ORDER BY rn
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ),
          2
        )
      ELSE propina_previa
    END AS propina_nueva
  FROM proporciones
),
normalizadas AS (
  SELECT
    pago_id,
    GREATEST(propina_nueva, 0) AS propina_nueva,
    metodo_propina,
    CASE
      WHEN COALESCE(comision_porcentaje, 0) > 0 THEN comision_porcentaje
      ELSE comision_bancaria
    END AS comision_aplicable
  FROM calculadas
)
UPDATE ventas.pagos p
SET
  propina_monto = normalizadas.propina_nueva,
  propina_neto = CASE
    WHEN normalizadas.propina_nueva <= 0 THEN 0
    WHEN normalizadas.metodo_propina LIKE '%tarjeta%' THEN
      ROUND(normalizadas.propina_nueva * (1 - normalizadas.comision_aplicable / 100), 2)
    ELSE normalizadas.propina_nueva
  END
FROM normalizadas
WHERE p.id = normalizadas.pago_id;

WITH ajustes(venta_id, descuento) AS (
  VALUES
    (73, 200.00::numeric),
    (74, 200.00::numeric),
    (75, 500.00::numeric)
)
SELECT
  a.venta_id AS folio,
  ROUND(COALESCE(SUM(p.propina_monto), 0), 2) AS propina_bruta_despues,
  ROUND(COALESCE(SUM(p.propina_neto), 0), 2) AS propina_neta_despues
FROM ajustes a
LEFT JOIN ventas.pagos p ON p.venta_id = a.venta_id AND COALESCE(p.propina_monto, 0) > 0
GROUP BY a.venta_id
ORDER BY a.venta_id;

COMMIT;
