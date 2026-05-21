-- Fix duplicates in catalogos.estados_mesa
DELETE FROM catalogos.estados_mesa 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (nombre) id FROM catalogos.estados_mesa 
    ORDER BY nombre, id DESC
  ) sub
);

-- Fix duplicates in catalogos.categorias
DELETE FROM catalogos.categorias 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (nombre) id FROM catalogos.categorias 
    ORDER BY nombre, id DESC
  ) sub
);

-- Fix duplicates in catalogos.roles
DELETE FROM catalogos.roles 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (nombre) id FROM catalogos.roles 
    ORDER BY nombre, id DESC
  ) sub
);

-- Fix duplicates in catalogos.metodos_pago
DELETE FROM catalogos.metodos_pago 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (nombre) id FROM catalogos.metodos_pago 
    ORDER BY nombre, id DESC
  ) sub
);

-- Fix duplicates in catalogos.tipos_cobro
DELETE FROM catalogos.tipos_cobro 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (nombre) id FROM catalogos.tipos_cobro 
    ORDER BY nombre, id DESC
  ) sub
);

-- Fix duplicates in catalogos.estados_item
DELETE FROM catalogos.estados_item 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (nombre) id FROM catalogos.estados_item 
    ORDER BY nombre, id DESC
  ) sub
);

-- ==================================================================
-- Ajuste opcional para jornadas con desfase UTC (+1 día en "fecha")
-- Úsalo solo si detectas que jornadas de la noche quedaron al día siguiente.
-- Ejemplo: pruebas del 10/05 quedaron como 11/05.
-- ==================================================================
UPDATE operacion.jornadas
SET fecha = fecha - INTERVAL '1 day'
WHERE hora_apertura::time < TIME '06:00:00'
  AND fecha = DATE(hora_apertura);

-- ==================================================================
-- NORMALIZACIÓN DE PAGOS: Separar propina incluida en monto
-- Los pagos históricos fueron guardados con propina incluida en "monto".
-- Este script detecta ventas donde separar propina acerca más al total real
-- y recalcula monto/monto_neto conservando la comisión histórica por pago.
-- ==================================================================
WITH resumen_ventas AS (
  SELECT
    v.id AS venta_id,
    ROUND(COALESCE(v.total_cuenta, 0)::numeric, 2) AS total_cuenta,
    ROUND(COALESCE(SUM(COALESCE(p.monto, 0)), 0)::numeric, 2) AS total_monto_actual,
    ROUND(COALESCE(SUM(
      CASE
        WHEN COALESCE(p.propina_monto, 0) > 0
             AND COALESCE(p.monto, 0) >= COALESCE(p.propina_monto, 0)
          THEN COALESCE(p.monto, 0) - COALESCE(p.propina_monto, 0)
        ELSE COALESCE(p.monto, 0)
      END
    ), 0)::numeric, 2) AS total_monto_sin_propina
  FROM ventas.ventas v
  JOIN ventas.pagos p ON p.venta_id = v.id
  GROUP BY v.id, v.total_cuenta
),
ventas_a_corregir AS (
  SELECT venta_id
  FROM resumen_ventas
  WHERE ABS(total_monto_sin_propina - total_cuenta) + 0.01
        < ABS(total_monto_actual - total_cuenta)
)
UPDATE ventas.pagos p
SET
  monto = ROUND(
    GREATEST(0, p.monto - COALESCE(p.propina_monto, 0))::numeric
  , 2),
  monto_neto = ROUND(
    GREATEST(0, p.monto - COALESCE(p.propina_monto, 0))::numeric
    * (1 - COALESCE(p.comision_porcentaje, 0) / 100)
  , 2)
FROM ventas_a_corregir v
WHERE p.venta_id = v.venta_id
  AND COALESCE(p.propina_monto, 0) > 0
  AND COALESCE(p.monto, 0) >= COALESCE(p.propina_monto, 0);

-- ==================================================================
-- NORMALIZACIÓN DE PROPINAS NETAS
-- Evita sobreconteo y descuenta comisión a propinas pagadas con tarjeta.
-- Si el pago ya trae una propina_neto válida menor a propina_monto, se respeta
-- para conservar el porcentaje histórico realmente aplicado.
-- ==================================================================
WITH parametros AS (
  SELECT COALESCE(MAX(comision_bancaria), 3.5)::numeric AS comision_bancaria
  FROM operacion.parametros_local
),
pagos_metodos AS (
  SELECT
    p.id,
    COALESCE(mp_propina.nombre, mp_pago.nombre, '') AS metodo_propina
  FROM ventas.pagos p
  LEFT JOIN catalogos.metodos_pago mp_pago ON mp_pago.id = p.metodo_pago_id
  LEFT JOIN catalogos.metodos_pago mp_propina ON mp_propina.id = p.propina_metodo_pago_id
)
UPDATE ventas.pagos p
SET propina_neto = ROUND(
  CASE
    WHEN COALESCE(p.propina_monto, 0) <= 0 THEN 0
    WHEN LOWER(pm.metodo_propina) LIKE '%tarjeta%'
         AND (
           p.propina_neto IS NULL
           OR COALESCE(p.propina_neto, 0) <= 0
           OR COALESCE(p.propina_neto, 0) >= COALESCE(p.propina_monto, 0)
         )
      THEN GREATEST(0, COALESCE(p.propina_monto, 0))::numeric
           * (1 - (
             CASE
               WHEN COALESCE(p.comision_porcentaje, 0) > 0 THEN p.comision_porcentaje
               ELSE parametros.comision_bancaria
             END
           ) / 100)
    ELSE
      CASE
        WHEN p.propina_neto IS NULL
          OR COALESCE(p.propina_neto, 0) <= 0
          OR COALESCE(p.propina_neto, 0) > COALESCE(p.propina_monto, 0)
        THEN COALESCE(p.propina_monto, 0)
        ELSE p.propina_neto
      END
  END::numeric
, 2)
FROM parametros, pagos_metodos pm
WHERE p.id = pm.id
  AND COALESCE(p.propina_monto, 0) > 0;

UPDATE ventas.pagos
SET propina_neto = 0
WHERE COALESCE(propina_monto, 0) <= 0
  AND COALESCE(propina_neto, 0) <> 0;
