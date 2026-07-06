const modelo = require('../models/personas.model');
const { validarPersona, normalizarPersona } = require('../validators/persona.validator');

const ID_REGEX = /^\d+$/;

// Valida el parámetro :id de la URL. Devuelve el id numérico o null si ya respondió con 400.
function validarId(req, res) {
  const { id } = req.params;
  if (!ID_REGEX.test(id)) {
    res.status(400).json({ error: 'El id debe ser un número entero positivo' });
    return null;
  }
  return Number(id);
}

// La tabla tiene índices únicos en rfc y correo; MySQL responde ER_DUP_ENTRY al violarlos.
function responderDuplicado(err, res) {
  if (!err || err.code !== 'ER_DUP_ENTRY') return false;
  const detalle = String(err.sqlMessage || '');
  let mensaje = 'Ya existe un registro con esos datos';
  if (detalle.includes('uq_personas_rfc')) mensaje = 'Ya existe un registro con ese RFC';
  else if (detalle.includes('uq_personas_correo')) mensaje = 'Ya existe un registro con ese correo electrónico';
  res.status(409).json({ error: mensaje });
  return true;
}

// GET /api/personas — Read (múltiples)
async function listar(req, res, next) {
  try {
    const personas = await modelo.obtenerTodas();
    res.json({ total: personas.length, data: personas });
  } catch (err) {
    next(err);
  }
}

// GET /api/personas/:id — Read (individual)
async function obtener(req, res, next) {
  const id = validarId(req, res);
  if (id === null) return;
  try {
    const persona = await modelo.obtenerPorId(id);
    if (!persona) return res.status(404).json({ error: `No existe un registro con id ${id}` });
    res.json({ data: persona });
  } catch (err) {
    next(err);
  }
}

// POST /api/personas — Create
async function crear(req, res, next) {
  const errores = validarPersona(req.body);
  if (errores.length > 0) {
    return res.status(400).json({ error: 'Datos de entrada inválidos', detalles: errores });
  }
  try {
    const persona = await modelo.crear(normalizarPersona(req.body));
    res.status(201).json({ mensaje: 'Registro creado correctamente', data: persona });
  } catch (err) {
    if (responderDuplicado(err, res)) return;
    next(err);
  }
}

// PUT /api/personas/:id — Update (reemplazo completo, valida todos los campos)
async function actualizar(req, res, next) {
  const id = validarId(req, res);
  if (id === null) return;
  const errores = validarPersona(req.body);
  if (errores.length > 0) {
    return res.status(400).json({ error: 'Datos de entrada inválidos', detalles: errores });
  }
  try {
    const persona = await modelo.actualizar(id, normalizarPersona(req.body));
    if (!persona) return res.status(404).json({ error: `No existe un registro con id ${id}` });
    res.json({ mensaje: 'Registro actualizado correctamente', data: persona });
  } catch (err) {
    if (responderDuplicado(err, res)) return;
    next(err);
  }
}

// DELETE /api/personas/:id — Delete
async function eliminar(req, res, next) {
  const id = validarId(req, res);
  if (id === null) return;
  try {
    const eliminado = await modelo.eliminar(id);
    if (!eliminado) return res.status(404).json({ error: `No existe un registro con id ${id}` });
    res.json({ mensaje: 'Registro eliminado correctamente' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
