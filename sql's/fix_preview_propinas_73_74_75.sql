WITH ajustes(venta_id, descuento) AS (
  VALUES
    (73, 200.00::numeric),
    (74, 200.00::numeric),
    (75, 500.00::numeric)
)
SELECT
  a.venta_id AS folio,
  COALESCE(CAST(v.fecha_cierre AS date), CAST(v.fecha_creacion AS date)) AS fecha,
  m.numero AS mesa,
  ROUND(COALESCE(SUM(p.propina_monto), 0), 2) AS propina_actual_bruta,
  ROUND(COALESCE(SUM(p.propina_neto), 0), 2) AS propina_actual_neta,
  a.descuento AS ajuste_a_restar,
  ROUND(GREATEST(COALESCE(SUM(p.propina_monto), 0) - a.descuento, 0), 2) AS propina_nueva_bruta_estimada
FROM ajustes a
LEFT JOIN ventas.ventas v ON v.id = a.venta_id
LEFT JOIN operacion.mesas m ON m.id = v.mesa_id
LEFT JOIN ventas.pagos p ON p.venta_id = v.id AND COALESCE(p.propina_monto, 0) > 0
GROUP BY a.venta_id, a.descuento, v.fecha_cierre, v.fecha_creacion, m.numero
ORDER BY a.venta_id;
