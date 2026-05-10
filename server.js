// server.js - Punto de entrada

require('dotenv').config();

const express = require('express');
const path    = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/eventos', require('./routes/eventos'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎉 Servidor corriendo en http://localhost:${PORT}`);
});
