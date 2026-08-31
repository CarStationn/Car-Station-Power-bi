const express = require('express');
const router = express.Router();
const secoesController = require('../controllers/secoesController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, secoesController.listarSecoes);
router.post('/', authMiddleware, adminMiddleware, secoesController.criarSecao);
router.put('/:id', authMiddleware, adminMiddleware, secoesController.editarSecao);
router.delete('/:id', authMiddleware, adminMiddleware, secoesController.deletarSecao);

module.exports = router;
