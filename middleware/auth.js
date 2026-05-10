// middleware/auth.js
// Middleware que verifica el JWT antes de dejar pasar al controller

const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado: falta el token de autenticación' });
    }

    const partes = authHeader.split(' ');
    if (partes.length !== 2 || partes[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Formato inválido. Usar: Authorization: Bearer <token>' });
    }

    const token = partes[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded; // disponible en el controller como req.usuario
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado. Volvé a iniciar sesión.' });
    }
}

module.exports = verificarToken;
