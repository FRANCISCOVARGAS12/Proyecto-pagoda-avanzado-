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
