const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas as rotas de orçamento passarão pelo middleware de proteção
router.use(authMiddleware);

router.get('/transactions', budgetController.getTransactions);
router.post('/transactions', budgetController.createTransaction);

module.exports = router;
