// db/index.js
// Conexión a MySQL usando mysql2 con soporte de Promises

const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de conexiones: reutiliza conexiones en lugar de abrir una nueva por cada query
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    database: process.env.DB_NAME     || 'gestion_eventos',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit:    10,
});

// Verificar conexión al iniciar
pool.getConnection()
    .then(conn => {
        console.log('✅ Conectado a MySQL exitosamente');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error al conectar a MySQL:', err.message);
    });

module.exports = pool;
