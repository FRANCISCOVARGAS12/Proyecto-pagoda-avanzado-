-- Agrega almacenamiento seguro para la contraseña de superusuario.
-- No guarda texto plano: el backend escribira aqui un hash BCrypt.

ALTER TABLE operacion.parametros_local
  ADD COLUMN IF NOT EXISTS superusuario_password_hash varchar(120);
