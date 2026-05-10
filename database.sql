-- ============================================================
--  TP3 - Sistema de Gestión de Eventos
--  Programación III - Tecnicatura en Programación
--  Base de datos: MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestion_eventos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestion_eventos;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    rol            VARCHAR(20)  DEFAULT 'participante',
    fecha_registro DATETIME     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS organizadores (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    nombre   VARCHAR(150) NOT NULL,
    email    VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(30),
    empresa  VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS eventos (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    titulo            VARCHAR(200)   NOT NULL,
    descripcion       TEXT,
    fecha_inicio      DATETIME       NOT NULL,
    fecha_fin         DATETIME       NOT NULL,
    lugar             VARCHAR(200)   NOT NULL,
    capacidad         INT            NOT NULL CHECK (capacidad > 0),
    cupos_disponibles INT            NOT NULL,
    precio            DECIMAL(10,2)  DEFAULT 0.00,
    estado            VARCHAR(20)    DEFAULT 'activo',
    id_categoria      INT,
    id_organizador    INT,
    fecha_creacion    DATETIME       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria)   REFERENCES categorias(id)   ON DELETE SET NULL,
    FOREIGN KEY (id_organizador) REFERENCES organizadores(id) ON DELETE SET NULL
);

-- Sin UNIQUE KEY compuesto: el SP maneja duplicados para permitir re-inscripción
CREATE TABLE IF NOT EXISTS inscripciones (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT           NOT NULL,
    id_evento         INT           NOT NULL,
    fecha_inscripcion DATETIME      DEFAULT CURRENT_TIMESTAMP,
    estado            VARCHAR(20)   DEFAULT 'confirmada',
    monto_pagado      DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (id_evento)  REFERENCES eventos(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS historial_inscripciones (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion INT         NOT NULL,
    id_evento      INT         NOT NULL,
    id_usuario     INT         NOT NULL,
    estado_ant     VARCHAR(20),
    estado_nuevo   VARCHAR(20),
    fecha_cambio   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================

INSERT INTO categorias (nombre, descripcion) VALUES
  ('Tecnología',     'Conferencias, hackathons y workshops de tech'),
  ('Música',         'Recitales, festivales y conciertos'),
  ('Deportes',       'Torneos, maratones y competencias'),
  ('Gastronomía',    'Ferias, degustaciones y cursos de cocina'),
  ('Arte y Cultura', 'Exposiciones, teatro y cine');

INSERT INTO organizadores (nombre, email, telefono, empresa) VALUES
  ('Lucía Fernández', 'lucia@eventospro.com',  '381-555-0001', 'EventosPro SRL'),
  ('Marcos Díaz',     'marcos@techmeet.com',   '381-555-0002', 'TechMeet'),
  ('Carolina Ruiz',   'caro@cultura.gob.ar',   '381-555-0003', 'Sec. de Cultura'),
  ('Diego Morales',   'diego@sportevents.com', '381-555-0004', 'Sport Events SA');

-- Contraseña: "123456" hasheada con bcrypt rounds=10
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Admin Sistema', 'admin@eventos.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh5a', 'admin'),
  ('Ana García',    'ana@mail.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh5a', 'participante'),
  ('Luis Torres',   'luis@mail.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh5a', 'participante');

INSERT INTO eventos (titulo, descripcion, fecha_inicio, fecha_fin, lugar, capacidad, cupos_disponibles, precio, id_categoria, id_organizador) VALUES
  ('NodeConf Argentina 2025',
   'Conferencia nacional sobre Node.js, APIs REST y ecosistema JavaScript.',
   DATE_ADD(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY),
   'Centro Cultural Tucumán - Av. Sarmiento 500', 200, 198, 0.00, 1, 2),

  ('Festival de Jazz del Norte',
   'Tres noches de jazz en vivo con artistas nacionales e internacionales.',
   DATE_ADD(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 22 DAY),
   'Plaza Independencia, San Miguel de Tucumán', 500, 497, 1500.00, 2, 1),

  ('Maratón Ciudad de Tucumán',
   'Maratón de 21km por el centro histórico.',
   DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY),
   'Casa Histórica de Tucumán', 300, 299, 800.00, 3, 4),

  ('Feria Gastronómica del NOA',
   'Degustaciones, food trucks y chefs invitados de todo el norte argentino.',
   DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY),
   'Parque 9 de Julio, Tucumán', 1000, 998, 500.00, 4, 1);

INSERT INTO inscripciones (id_usuario, id_evento, monto_pagado) VALUES
  (2, 1, 0.00),
  (3, 1, 0.00),
  (2, 4, 500.00);

-- ============================================================
-- STORED PROCEDURE: inscribir_participante
-- Maneja re-inscripción: UPDATE si existe cancelada, INSERT si es nueva
-- ============================================================
DROP PROCEDURE IF EXISTS inscribir_participante;

DELIMITER $$

CREATE PROCEDURE inscribir_participante(
    IN p_id_usuario INT,
    IN p_id_evento  INT
)
BEGIN
    DECLARE v_cupos              INT DEFAULT 0;
    DECLARE v_estado             VARCHAR(20);
    DECLARE v_precio             DECIMAL(10,2);
    DECLARE v_existe_confirmada  INT DEFAULT 0;
    DECLARE v_id_inscripcion     INT DEFAULT 0;

    -- Lock para evitar race condition de cupos
    SELECT cupos_disponibles, estado, precio
      INTO v_cupos, v_estado, v_precio
    FROM eventos
    WHERE id = p_id_evento
    FOR UPDATE;

    IF v_estado IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El evento no existe';
    END IF;

    IF v_estado != 'activo' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El evento no está disponible para inscripciones';
    END IF;

    IF v_cupos <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El evento no tiene cupos disponibles';
    END IF;

    -- ¿Ya está inscripto y confirmado?
    SELECT COUNT(*) INTO v_existe_confirmada
    FROM inscripciones
    WHERE id_usuario = p_id_usuario
      AND id_evento  = p_id_evento
      AND estado     = 'confirmada';

    IF v_existe_confirmada > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El usuario ya está inscripto en este evento';
    END IF;

    -- ¿Existe una inscripción cancelada? → re-inscripción
    SELECT id INTO v_id_inscripcion
    FROM inscripciones
    WHERE id_usuario = p_id_usuario
      AND id_evento  = p_id_evento
      AND estado     = 'cancelada'
    ORDER BY id DESC
    LIMIT 1;

    IF v_id_inscripcion > 0 THEN
        UPDATE inscripciones
        SET estado            = 'confirmada',
            monto_pagado      = v_precio,
            fecha_inscripcion = NOW()
        WHERE id = v_id_inscripcion;
    ELSE
        INSERT INTO inscripciones (id_usuario, id_evento, monto_pagado)
        VALUES (p_id_usuario, p_id_evento, v_precio);
    END IF;

    UPDATE eventos
    SET cupos_disponibles = cupos_disponibles - 1
    WHERE id = p_id_evento;

END$$

DELIMITER ;

-- ============================================================
-- TRIGGER: log_cambio_inscripcion
-- AFTER UPDATE en inscripciones: historial + devolución de cupo
-- ============================================================
DROP TRIGGER IF EXISTS log_cambio_inscripcion;

DELIMITER $$

CREATE TRIGGER log_cambio_inscripcion
AFTER UPDATE ON inscripciones
FOR EACH ROW
BEGIN
    IF OLD.estado != NEW.estado THEN

        INSERT INTO historial_inscripciones (id_inscripcion, id_evento, id_usuario, estado_ant, estado_nuevo)
        VALUES (OLD.id, OLD.id_evento, OLD.id_usuario, OLD.estado, NEW.estado);

        -- Cancelación confirmada → devolver cupo
        IF OLD.estado = 'confirmada' AND NEW.estado = 'cancelada' THEN
            UPDATE eventos
            SET cupos_disponibles = cupos_disponibles + 1
            WHERE id = OLD.id_evento;
        END IF;

    END IF;
END$$

DELIMITER ;
