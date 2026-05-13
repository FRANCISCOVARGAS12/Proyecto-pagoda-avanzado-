ALTER TABLE operacion.parametros_local
  ADD COLUMN IF NOT EXISTS rol_por_defecto varchar(50) NOT NULL DEFAULT 'MESERO',
  ADD COLUMN IF NOT EXISTS auto_logout_minutos integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS impresora_tickets varchar(30) NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS imprimir_resumen_cierre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS encabezado_ticket varchar(160) NOT NULL DEFAULT 'Restaurante Asiático',
  ADD COLUMN IF NOT EXISTS pie_ticket varchar(220) NOT NULL DEFAULT '¡Gracias por su visita!';

UPDATE operacion.parametros_local
SET
  rol_por_defecto = COALESCE(NULLIF(TRIM(rol_por_defecto), ''), 'MESERO'),
  auto_logout_minutos = CASE WHEN auto_logout_minutos < 0 THEN 30 ELSE auto_logout_minutos END,
  impresora_tickets = CASE
    WHEN impresora_tickets IN ('default', 'thermal', 'none') THEN impresora_tickets
    ELSE 'default'
  END,
  encabezado_ticket = COALESCE(NULLIF(TRIM(encabezado_ticket), ''), 'Restaurante Asiático'),
  pie_ticket = COALESCE(NULLIF(TRIM(pie_ticket), ''), '¡Gracias por su visita!');

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
  COALESCE(p.propina_monto, 0)::numeric
  * (1 - (
    CASE
      WHEN COALESCE(p.comision_porcentaje, 0) > 0 THEN p.comision_porcentaje
      ELSE parametros.comision_bancaria
    END
  ) / 100)
, 2)
FROM parametros, pagos_metodos pm
WHERE p.id = pm.id
  AND COALESCE(p.propina_monto, 0) > 0
  AND LOWER(pm.metodo_propina) LIKE '%tarjeta%'
  AND (
    p.propina_neto IS NULL
    OR COALESCE(p.propina_neto, 0) <= 0
    OR COALESCE(p.propina_neto, 0) >= COALESCE(p.propina_monto, 0)
  );
