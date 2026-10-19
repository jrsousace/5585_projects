const express = require('express');
const router = express.Router();
const auxiliaryController = require('../controllers/auxiliaryController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware); // Todas as rotas auxiliares precisam de login

// Rotas de Categorias
router.get('/categorias', auxiliaryController.getCategorias);
router.post('/categorias', auxiliaryController.createCategoria);

// Rotas de Formas de Pagamento
router.get('/formas-pagamento', auxiliaryController.getFormasPagamento);

// Rotas de Contas
router.get('/contas', auxiliaryController.getContas);
router.post('/contas', auxiliaryController.createConta);

// Rotas de Bancos
router.get('/bancos', auxiliaryController.getBancos);

module.exports = router;
