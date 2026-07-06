const mysql = require('mysql2/promise');

// Pool de conexiones compartido por toda la aplicación.
// En AWS Lambda usa DB_POOL_SIZE=2 (cada instancia de Lambda crea su propio pool).
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crud_personas',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
  queueLimit: 0,
});

module.exports = pool;
