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
