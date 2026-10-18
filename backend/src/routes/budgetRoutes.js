const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');

// Simulação simples de Middleware para checar Token (a ser expandido)
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });
  // Aqui validaríamos o JWT com jsonwebtoken
  next();
};

router.use(authMiddleware);

router.get('/transactions', budgetController.getTransactions);

module.exports = router;
