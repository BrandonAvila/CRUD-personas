// Validaciones a nivel backend para el recurso "persona".

// RFC (SAT, México): 3 letras (persona moral) o 4 (persona física) — pueden
// incluir Ñ y & —, seguidas de la fecha de nacimiento/constitución en formato
// AAMMDD y una homoclave de 3 caracteres cuyo último carácter (dígito
// verificador) solo puede ser un número o la letra A.
const RFC_REGEX = /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2})([A\d])$/;

// Formato general de correo: usuario@dominio.tld, sin espacios y con TLD de al menos 2 caracteres.
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Código postal mexicano: exactamente 5 dígitos (se exige cadena para no perder ceros a la izquierda).
const CODIGO_POSTAL_REGEX = /^\d{5}$/;

function esVacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

/**
 * Valida el cuerpo recibido para crear o actualizar una persona.
 * @returns {Array<{campo: string, mensaje: string}>} lista de errores; vacía = datos válidos.
 */
function validarPersona(datos) {
  const cuerpo = datos && typeof datos === 'object' ? datos : {};
  const { nombreCompleto, rfc, correo, codigoPostal } = cuerpo;
  const errores = [];

  if (esVacio(nombreCompleto)) {
    errores.push({ campo: 'nombreCompleto', mensaje: 'El nombre completo es obligatorio' });
  } else if (typeof nombreCompleto !== 'string') {
    errores.push({ campo: 'nombreCompleto', mensaje: 'El nombre completo debe ser una cadena de texto' });
  } else if (nombreCompleto.trim().length < 3 || nombreCompleto.trim().length > 255) {
    errores.push({ campo: 'nombreCompleto', mensaje: 'El nombre completo debe tener entre 3 y 255 caracteres' });
  }

  if (esVacio(rfc)) {
    errores.push({ campo: 'rfc', mensaje: 'El RFC es obligatorio' });
  } else if (typeof rfc !== 'string' || !RFC_REGEX.test(rfc.trim().toUpperCase())) {
    errores.push({
      campo: 'rfc',
      mensaje: 'El RFC no tiene un formato válido: 12-13 caracteres con fecha y homoclave (ej. GODE561231GR8)',
    });
  }

  if (esVacio(correo)) {
    errores.push({ campo: 'correo', mensaje: 'El correo electrónico es obligatorio' });
  } else if (typeof correo !== 'string' || correo.trim().length > 254 || !CORREO_REGEX.test(correo.trim())) {
    errores.push({
      campo: 'correo',
      mensaje: 'El correo electrónico no tiene un formato válido (ej. usuario@dominio.com)',
    });
  }

  if (esVacio(codigoPostal)) {
    errores.push({ campo: 'codigoPostal', mensaje: 'El código postal es obligatorio' });
  } else if (typeof codigoPostal !== 'string' || !CODIGO_POSTAL_REGEX.test(codigoPostal.trim())) {
    errores.push({
      campo: 'codigoPostal',
      mensaje: 'El código postal debe ser una cadena de exactamente 5 dígitos (ej. "06600")',
    });
  }

  return errores;
}

/** Normaliza los campos antes de guardarlos en la base de datos. */
function normalizarPersona(datos) {
  return {
    nombreCompleto: datos.nombreCompleto.trim(),
    rfc: datos.rfc.trim().toUpperCase(),
    correo: datos.correo.trim().toLowerCase(),
    codigoPostal: datos.codigoPostal.trim(),
  };
}

module.exports = {
  validarPersona,
  normalizarPersona,
  RFC_REGEX,
  CORREO_REGEX,
  CODIGO_POSTAL_REGEX,
};
