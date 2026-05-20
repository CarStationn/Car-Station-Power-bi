const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, rolesController.listarRoles);
router.post('/', authMiddleware, adminMiddleware, rolesController.criarRole);
router.put('/:id', authMiddleware, adminMiddleware, rolesController.editarRole);
router.delete('/:id', authMiddleware, adminMiddleware, rolesController.deletarRole);

module.exports = router;
