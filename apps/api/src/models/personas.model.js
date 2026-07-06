const pool = require('../db');

// Convierte una fila de MySQL (snake_case) al formato JSON de la API (camelCase).
function mapearFila(fila) {
  return {
    id: fila.id,
    nombreCompleto: fila.nombre_completo,
    rfc: fila.rfc,
    correo: fila.correo,
    codigoPostal: fila.codigo_postal,
    creadoEn: fila.created_at,
    actualizadoEn: fila.updated_at,
  };
}

async function obtenerTodas() {
  const [filas] = await pool.query('SELECT * FROM personas ORDER BY id DESC');
  return filas.map(mapearFila);
}

async function obtenerPorId(id) {
  const [filas] = await pool.query('SELECT * FROM personas WHERE id = ?', [id]);
  return filas.length > 0 ? mapearFila(filas[0]) : null;
}

async function crear(persona) {
  const [resultado] = await pool.query(
    'INSERT INTO personas (nombre_completo, rfc, correo, codigo_postal) VALUES (?, ?, ?, ?)',
    [persona.nombreCompleto, persona.rfc, persona.correo, persona.codigoPostal]
  );
  return obtenerPorId(resultado.insertId);
}

async function actualizar(id, persona) {
  const [resultado] = await pool.query(
    'UPDATE personas SET nombre_completo = ?, rfc = ?, correo = ?, codigo_postal = ? WHERE id = ?',
    [persona.nombreCompleto, persona.rfc, persona.correo, persona.codigoPostal, id]
  );
  return resultado.affectedRows > 0 ? obtenerPorId(id) : null;
}

async function eliminar(id) {
  const [resultado] = await pool.query('DELETE FROM personas WHERE id = ?', [id]);
  return resultado.affectedRows > 0;
}

module.exports = { obtenerTodas, obtenerPorId, crear, actualizar, eliminar };
