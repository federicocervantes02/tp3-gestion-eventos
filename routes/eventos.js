// routes/eventos.js
const express        = require('express');
const router         = express.Router();
const verificarToken = require('../middleware/auth');
const {
    getEventos, getEventoById, crearEvento, actualizarEvento, eliminarEvento,
    inscribirse, cancelarInscripcion, getInscripciones, getMisInscripciones,
    getCategorias, getOrganizadores
} = require('../controllers/controllers');

// Todas las rutas requieren JWT
router.use(verificarToken);

// Auxiliares (ANTES de /:id para que no confunda "aux" con un ID numérico)
router.get('/aux/categorias',        getCategorias);
router.get('/aux/organizadores',     getOrganizadores);
router.get('/mis-inscripciones',     getMisInscripciones);

// CRUD de eventos
router.get('/',    getEventos);
router.get('/:id', getEventoById);
router.post('/',   crearEvento);
router.put('/:id', actualizarEvento);
router.delete('/:id', eliminarEvento);

// Sub-recursos de inscripciones
router.post('/:id/inscribir',              inscribirse);
router.delete('/:id/cancelar-inscripcion', cancelarInscripcion);
router.get('/:id/inscripciones',           getInscripciones);

module.exports = router;
