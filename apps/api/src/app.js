const express = require('express');
const cors = require('cors');
const pool = require('./db');
const personasRouter = require('./routes/personas.routes');

const app = express();

// CORS abierto para la demo; en producción restringe el origen del frontend.
app.use(cors());
app.use(express.json());

// Salud del servicio y de la conexión a la base de datos.
app.get('/health', async (req, res) => {
  let baseDatos = 'sin conexión';
  try {
    await pool.query('SELECT 1');
    baseDatos = 'conectada';
  } catch {
    // se reporta como "sin conexión"
  }
  res.json({ servicio: 'api-personas', estado: 'ok', baseDatos });
});

app.use('/api/personas', personasRouter);

// 404 para rutas no definidas
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Errores de conexión/configuración de MySQL que se reportan como 503.
const CODIGOS_SIN_BD = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
];

// Manejador global de errores: siempre responde JSON.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  if (CODIGOS_SIN_BD.includes(err.code)) {
    console.error('Error de base de datos:', err.code, err.message);
    return res.status(503).json({ error: 'No hay conexión con la base de datos' });
  }
  console.error('Error no controlado:', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
