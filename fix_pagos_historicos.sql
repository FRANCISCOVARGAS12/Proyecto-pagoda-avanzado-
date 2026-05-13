-- Corrige pedidos historicos donde los pagos no suman el total real de platillos.
-- Fuente de verdad para venta: SUM(items_venta.precio_unitario * cantidad).
-- Respaldo generado antes de actualizar:
--   ventas.fix_ventas_historicos_backup_20260512
--   ventas.fix_pagos_historicos_backup_20260512

CREATE TABLE IF NOT EXISTS ventas.fix_ventas_historicos_backup_20260512 AS
WITH item_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(precio_unitario, 0) * COALESCE(cantidad, 0))::numeric, 2) AS items_total
  FROM ventas.items_venta
  GROUP BY venta_id
),
payment_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(monto, 0))::numeric, 2) AS pagos_monto
  FROM ventas.pagos
  GROUP BY venta_id
),
ventas_objetivo AS (
  SELECT v.id
  FROM ventas.ventas v
  JOIN item_totals it ON it.venta_id = v.id
  LEFT JOIN payment_totals pt ON pt.venta_id = v.id
  WHERE v.fecha_cierre IS NOT NULL
    AND it.items_total > 0
    AND (
      ABS(COALESCE(v.total_cuenta, 0) - it.items_total) > 0.01
      OR ABS(COALESCE(pt.pagos_monto, 0) - it.items_total) > 0.01
    )
)
SELECT
  NOW() AS backup_created_at,
  v.*
FROM ventas.ventas v
JOIN ventas_objetivo vo ON vo.id = v.id;

CREATE TABLE IF NOT EXISTS ventas.fix_pagos_historicos_backup_20260512 AS
WITH item_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(precio_unitario, 0) * COALESCE(cantidad, 0))::numeric, 2) AS items_total
  FROM ventas.items_venta
  GROUP BY venta_id
),
payment_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(monto, 0))::numeric, 2) AS pagos_monto
  FROM ventas.pagos
  GROUP BY venta_id
),
ventas_objetivo AS (
  SELECT v.id
  FROM ventas.ventas v
  JOIN item_totals it ON it.venta_id = v.id
  LEFT JOIN payment_totals pt ON pt.venta_id = v.id
  WHERE v.fecha_cierre IS NOT NULL
    AND it.items_total > 0
    AND ABS(COALESCE(pt.pagos_monto, 0) - it.items_total) > 0.01
)
SELECT
  NOW() AS backup_created_at,
  p.*
FROM ventas.pagos p
JOIN ventas_objetivo vo ON vo.id = p.venta_id;

WITH item_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(precio_unitario, 0) * COALESCE(cantidad, 0))::numeric, 2) AS items_total
  FROM ventas.items_venta
  GROUP BY venta_id
)
UPDATE ventas.ventas v
SET total_cuenta = it.items_total
FROM item_totals it
WHERE v.id = it.venta_id
  AND v.fecha_cierre IS NOT NULL
  AND it.items_total > 0
  AND ABS(COALESCE(v.total_cuenta, 0) - it.items_total) > 0.01;

WITH item_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(precio_unitario, 0) * COALESCE(cantidad, 0))::numeric, 2) AS items_total
  FROM ventas.items_venta
  GROUP BY venta_id
),
payment_totals AS (
  SELECT
    venta_id,
    ROUND(SUM(COALESCE(monto, 0))::numeric, 2) AS pagos_monto
  FROM ventas.pagos
  GROUP BY venta_id
),
ventas_objetivo AS (
  SELECT
    v.id AS venta_id,
    it.items_total
  FROM ventas.ventas v
  JOIN item_totals it ON it.venta_id = v.id
  LEFT JOIN payment_totals pt ON pt.venta_id = v.id
  WHERE v.fecha_cierre IS NOT NULL
    AND it.items_total > 0
    AND ABS(COALESCE(pt.pagos_monto, 0) - it.items_total) > 0.01
),
pagos_base AS (
  SELECT
    p.id,
    p.venta_id,
    vo.items_total,
    COALESCE(p.monto, 0)::numeric AS monto_actual,
    COALESCE(p.propina_monto, 0)::numeric AS propina_actual,
    COALESCE(p.comision_porcentaje, 0)::numeric AS comision,
    GREATEST(
      COALESCE(p.monto, 0) + COALESCE(p.propina_monto, 0),
      COALESCE(p.monto, 0),
      COALESCE(p.propina_monto, 0),
      0
    )::numeric AS peso,
    SUM(GREATEST(
      COALESCE(p.monto, 0) + COALESCE(p.propina_monto, 0),
      COALESCE(p.monto, 0),
      COALESCE(p.propina_monto, 0),
      0
    )::numeric) OVER (PARTITION BY p.venta_id) AS peso_total,
    COUNT(*) OVER (PARTITION BY p.venta_id) AS pagos_count,
    ROW_NUMBER() OVER (PARTITION BY p.venta_id ORDER BY p.id DESC) AS rn_desc
  FROM ventas.pagos p
  JOIN ventas_objetivo vo ON vo.venta_id = p.venta_id
),
calculados AS (
  SELECT
    *,
    CASE
      WHEN peso_total > 0
        THEN ROUND(items_total * peso / peso_total, 2)
      ELSE ROUND(items_total / NULLIF(pagos_count, 0), 2)
    END AS monto_calc
  FROM pagos_base
),
ajustados AS (
  SELECT
    *,
    CASE
      WHEN rn_desc = 1
        THEN ROUND(monto_calc + (items_total - SUM(monto_calc) OVER (PARTITION BY venta_id)), 2)
      ELSE monto_calc
    END AS nuevo_monto
  FROM calculados
)
UPDATE ventas.pagos p
SET
  monto = a.nuevo_monto,
  monto_neto = ROUND(a.nuevo_monto * (1 - COALESCE(p.comision_porcentaje, 0) / 100), 2)
FROM ajustados a
WHERE p.id = a.id;

-- Verificacion resumida.
WITH por_venta AS (
  SELECT
    v.id,
    v.total_cuenta,
    ROUND(COALESCE(SUM(i.precio_unitario * i.cantidad), 0)::numeric, 2) AS items_total,
    COALESCE(pagos.total_monto, 0) AS pagos_monto
  FROM ventas.ventas v
  LEFT JOIN ventas.items_venta i ON i.venta_id = v.id
  LEFT JOIN (
    SELECT
      venta_id,
      ROUND(SUM(COALESCE(monto, 0))::numeric, 2) AS total_monto
    FROM ventas.pagos
    GROUP BY venta_id
  ) pagos ON pagos.venta_id = v.id
  WHERE v.fecha_cierre IS NOT NULL
  GROUP BY v.id, v.total_cuenta, pagos.total_monto
)
SELECT
  COUNT(*) FILTER (WHERE ABS(total_cuenta - items_total) > 0.01) AS ventas_total_distinto_items,
  COUNT(*) FILTER (WHERE ABS(pagos_monto - items_total) > 0.01) AS ventas_pagos_distinto_items
FROM por_venta;
