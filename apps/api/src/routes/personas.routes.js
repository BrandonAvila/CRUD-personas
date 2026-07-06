const { Router } = require('express');
const controlador = require('../controllers/personas.controller');

const router = Router();

router.get('/', controlador.listar); //        Read (múltiples)
router.get('/:id', controlador.obtener); //    Read (individual)
router.post('/', controlador.crear); //        Create
router.put('/:id', controlador.actualizar); // Update
router.delete('/:id', controlador.eliminar); //Delete

module.exports = router;
