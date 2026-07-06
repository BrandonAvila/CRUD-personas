-- Esquema de la base de datos del microservicio CRUD de personas.
-- En local se ejecuta automáticamente al crear el contenedor de docker-compose.
-- En AWS RDS ejecútalo manualmente (MySQL Workbench, DBeaver o cliente mysql).

CREATE DATABASE IF NOT EXISTS crud_personas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE crud_personas;

CREATE TABLE IF NOT EXISTS personas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_completo VARCHAR(255) NOT NULL,
  rfc VARCHAR(13) NOT NULL COMMENT 'RFC con homoclave: 13 caracteres persona física, 12 persona moral',
  correo VARCHAR(254) NOT NULL,
  codigo_postal CHAR(5) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_personas_rfc (rfc),
  UNIQUE KEY uq_personas_correo (correo)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Datos de ejemplo (INSERT IGNORE = idempotente, no truena si ya existen)
INSERT IGNORE INTO personas (nombre_completo, rfc, correo, codigo_postal) VALUES
  ('María Guadalupe Ochoa Díaz', 'GODE561231GR8', 'maria.ochoa@ejemplo.com', '06600'),
  ('Comercializadora ABC S.A. de C.V.', 'ABC680524P76', 'contacto@abc-ejemplo.com', '44100');
