// controllers/controllers.js
// Lógica de cada endpoint – MySQL (mysql2/promise)

const pool   = require('../db/index');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ============================================================
// AUTH
// ============================================================

// POST /api/auth/register
async function register(req, res) {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'nombre, email y password son requeridos' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
            [nombre.trim(), email.trim().toLowerCase(), hash]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: { id: result.insertId, nombre: nombre.trim(), email: email.trim().toLowerCase(), rol: 'participante' }
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El email ya está registrado' });
        }
        console.error('Error en register:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// POST /api/auth/login
async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email y password son requeridos' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const usuario = rows[0];
        const ok = await bcrypt.compare(password, usuario.password_hash);

        if (!ok) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol, nombre: usuario.nombre },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// ============================================================
// EVENTOS
// ============================================================

// GET /api/eventos
async function getEventos(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT e.id, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
                   e.lugar, e.capacidad, e.cupos_disponibles, e.precio, e.estado,
                   c.nombre  AS categoria,
                   o.nombre  AS organizador,
                   o.empresa AS empresa_organizadora
            FROM eventos e
            LEFT JOIN categorias    c ON e.id_categoria   = c.id
            LEFT JOIN organizadores o ON e.id_organizador = o.id
            ORDER BY e.fecha_inicio ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error en getEventos:', err);
        res.status(500).json({ error: 'Error al obtener los eventos' });
    }
}

// GET /api/eventos/:id
async function getEventoById(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT e.id, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
                   e.lugar, e.capacidad, e.cupos_disponibles, e.precio, e.estado,
                   e.fecha_creacion, e.id_categoria, e.id_organizador,
                   c.nombre   AS categoria,
                   o.nombre   AS organizador,
                   o.email    AS email_organizador,
                   o.telefono AS telefono_organizador,
                   o.empresa  AS empresa_organizadora
            FROM eventos e
            LEFT JOIN categorias    c ON e.id_categoria   = c.id
            LEFT JOIN organizadores o ON e.id_organizador = o.id
            WHERE e.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error en getEventoById:', err);
        res.status(500).json({ error: 'Error al obtener el evento' });
    }
}

// POST /api/eventos
async function crearEvento(req, res) {
    const { titulo, descripcion, fecha_inicio, fecha_fin, lugar, capacidad, precio, id_categoria, id_organizador } = req.body;

    if (!titulo || !fecha_inicio || !fecha_fin || !lugar || !capacidad) {
        return res.status(400).json({ error: 'titulo, fecha_inicio, fecha_fin, lugar y capacidad son requeridos' });
    }

    try {
        const cap = parseInt(capacidad);
        if (isNaN(cap) || cap <= 0) {
            return res.status(400).json({ error: 'La capacidad debe ser un número positivo' });
        }

        const [result] = await pool.query(
            `INSERT INTO eventos
               (titulo, descripcion, fecha_inicio, fecha_fin, lugar, capacidad,
                cupos_disponibles, precio, id_categoria, id_organizador)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [titulo.trim(), descripcion?.trim() || null, fecha_inicio, fecha_fin, lugar.trim(),
             cap, cap, parseFloat(precio) || 0,
             id_categoria || null, id_organizador || null]
        );
        res.status(201).json({ mensaje: 'Evento creado correctamente', id: result.insertId });
    } catch (err) {
        console.error('Error en crearEvento:', err);
        res.status(500).json({ error: 'Error al crear el evento' });
    }
}

// PUT /api/eventos/:id  → transacción con ROLLBACK
async function actualizarEvento(req, res) {
    const { id } = req.params;
    const { titulo, descripcion, fecha_inicio, fecha_fin, lugar, capacidad, precio, estado, id_categoria, id_organizador } = req.body;

    const estadosValidos = ['activo', 'cancelado', 'finalizado'];
    if (estado && !estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido. Valores permitidos: activo, cancelado, finalizado' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            'SELECT id, capacidad, cupos_disponibles FROM eventos WHERE id = ?', [id]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        const actual = rows[0];

        let nuevosCupos = actual.cupos_disponibles;
        if (capacidad && parseInt(capacidad) !== actual.capacidad) {
            const inscriptos = actual.capacidad - actual.cupos_disponibles;
            nuevosCupos = Math.max(0, parseInt(capacidad) - inscriptos);
        }

        await conn.query(
            `UPDATE eventos SET
               titulo            = COALESCE(?, titulo),
               descripcion       = COALESCE(?, descripcion),
               fecha_inicio      = COALESCE(?, fecha_inicio),
               fecha_fin         = COALESCE(?, fecha_fin),
               lugar             = COALESCE(?, lugar),
               capacidad         = COALESCE(?, capacidad),
               cupos_disponibles = ?,
               precio            = COALESCE(?, precio),
               estado            = COALESCE(?, estado),
               id_categoria      = COALESCE(?, id_categoria),
               id_organizador    = COALESCE(?, id_organizador)
             WHERE id = ?`,
            [titulo?.trim() || null, descripcion?.trim() || null, fecha_inicio || null,
             fecha_fin || null, lugar?.trim() || null,
             capacidad ? parseInt(capacidad) : null,
             nuevosCupos, precio !== undefined ? parseFloat(precio) : null,
             estado || null, id_categoria || null, id_organizador || null, id]
        );

        await conn.commit();
        res.json({ mensaje: 'Evento actualizado correctamente' });

    } catch (err) {
        await conn.rollback();
        console.error('Error en actualizarEvento (ROLLBACK ejecutado):', err);
        res.status(500).json({ error: 'Error al actualizar el evento. Se revirtieron los cambios.' });
    } finally {
        conn.release();
    }
}

// DELETE /api/eventos/:id → soft delete (estado = cancelado)
async function eliminarEvento(req, res) {
    const { id } = req.params;
    try {
        const [result] = await pool.query(
            "UPDATE eventos SET estado = 'cancelado' WHERE id = ?", [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        res.json({ mensaje: 'Evento cancelado correctamente' });
    } catch (err) {
        console.error('Error en eliminarEvento:', err);
        res.status(500).json({ error: 'Error al cancelar el evento' });
    }
}

// ============================================================
// INSCRIPCIONES
// ============================================================

// POST /api/eventos/:id/inscribir  → stored procedure
async function inscribirse(req, res) {
    const id_evento  = parseInt(req.params.id);
    const id_usuario = req.usuario.id;

    if (isNaN(id_evento)) {
        return res.status(400).json({ error: 'ID de evento inválido' });
    }

    try {
        await pool.query('CALL inscribir_participante(?, ?)', [id_usuario, id_evento]);
        res.status(201).json({ mensaje: 'Inscripción realizada correctamente' });
    } catch (err) {
        console.error('Error en inscribirse:', err);
        // MySQL devuelve el texto del SIGNAL en err.message (o sqlMessage)
        const msg = err.sqlMessage || err.message || 'Error al inscribirse';
        res.status(400).json({ error: msg });
    }
}

// DELETE /api/eventos/:id/cancelar-inscripcion
async function cancelarInscripcion(req, res) {
    const id_evento  = parseInt(req.params.id);
    const id_usuario = req.usuario.id;

    if (isNaN(id_evento)) {
        return res.status(400).json({ error: 'ID de evento inválido' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE inscripciones
             SET estado = 'cancelada'
             WHERE id_usuario = ? AND id_evento = ? AND estado = 'confirmada'`,
            [id_usuario, id_evento]
        );
        // El trigger devuelve el cupo automáticamente

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No se encontró una inscripción activa para cancelar' });
        }
        res.json({ mensaje: 'Inscripción cancelada. El cupo fue devuelto al evento.' });
    } catch (err) {
        console.error('Error en cancelarInscripcion:', err);
        res.status(500).json({ error: 'Error al cancelar la inscripción' });
    }
}

// GET /api/eventos/:id/inscripciones
async function getInscripciones(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT i.id, i.fecha_inscripcion, i.estado, i.monto_pagado,
                   u.nombre AS participante, u.email
            FROM inscripciones i
            JOIN usuarios u ON i.id_usuario = u.id
            WHERE i.id_evento = ?
            ORDER BY i.fecha_inscripcion ASC
        `, [id]);
        res.json(rows);
    } catch (err) {
        console.error('Error en getInscripciones:', err);
        res.status(500).json({ error: 'Error al obtener inscripciones' });
    }
}

// GET /api/eventos/mis-inscripciones → inscripciones del usuario logueado
async function getMisInscripciones(req, res) {
    const id_usuario = req.usuario.id;
    try {
        const [rows] = await pool.query(`
            SELECT i.id_evento
            FROM inscripciones i
            WHERE i.id_usuario = ? AND i.estado = 'confirmada'
        `, [id_usuario]);
        // Devolver solo los IDs para que el frontend los marque
        res.json(rows.map(r => r.id_evento));
    } catch (err) {
        console.error('Error en getMisInscripciones:', err);
        res.status(500).json({ error: 'Error al obtener tus inscripciones' });
    }
}

// ============================================================
// AUXILIARES
// ============================================================

async function getCategorias(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM categorias ORDER BY nombre');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
}

async function getOrganizadores(req, res) {
    try {
        const [rows] = await pool.query('SELECT id, nombre, empresa FROM organizadores ORDER BY nombre');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener organizadores' });
    }
}

module.exports = {
    register, login,
    getEventos, getEventoById, crearEvento, actualizarEvento, eliminarEvento,
    inscribirse, cancelarInscripcion, getInscripciones, getMisInscripciones,
    getCategorias, getOrganizadores
};
