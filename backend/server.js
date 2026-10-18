const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const budgetRoutes = require('./src/routes/budgetRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite requisições do frontend
app.use(express.json()); // Parseia body em JSON

// Rotas Base
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API SaaS Financeiro rodando!' });
});

// Registrar rotas
app.use('/api/auth', authRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/auxiliary', require('./src/routes/auxiliaryRoutes'));
app.use('/api/investments', require('./src/routes/investmentsRoutes'));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
