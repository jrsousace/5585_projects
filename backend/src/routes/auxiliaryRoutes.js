const express = require('express');
const router = express.Router();
const auxiliaryController = require('../controllers/auxiliaryController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

router.use(authMiddleware); // Todas as rotas auxiliares precisam de login

// Rotas de Categorias
router.get('/categorias', requirePermission('budget', 'read'), auxiliaryController.getCategorias);
router.post('/categorias', requirePermission('budget', 'write'), auxiliaryController.createCategoria);

// Rotas de Formas de Pagamento
router.get('/formas-pagamento', requirePermission('budget', 'read'), auxiliaryController.getFormasPagamento);

// Rotas de Contas
router.get('/contas', requirePermission('budget', 'read'), auxiliaryController.getContas);
router.post('/contas', requirePermission('budget', 'write'), auxiliaryController.createConta);

// Rotas de Bancos
router.get('/bancos', requirePermission('budget', 'read'), auxiliaryController.getBancos);

module.exports = router;
