-- Desactiva todos los administradores actuales sin romper historiales ligados por FK.
-- Despues de ejecutar esto, el panel pedira superusuario y permitira registrar el primer admin.

UPDATE operacion.usuarios u
SET activo = false
FROM catalogos.roles r
WHERE u.rol_id = r.id
  AND UPPER(r.nombre) = 'ADMIN'
  AND u.activo = true;

-- Verificacion: debe regresar 0 administradores activos.
SELECT COUNT(*) AS admins_activos
FROM operacion.usuarios u
JOIN catalogos.roles r ON r.id = u.rol_id
WHERE UPPER(r.nombre) = 'ADMIN'
  AND u.activo = true;
