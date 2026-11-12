const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const budgetRoutes = require('./src/routes/budgetRoutes');

const app = express();
const PORT = process.env.PORT || 8080;
app.set('trust proxy', 1);
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || 'https://5585projects.com.br')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

// Middlewares
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 600
}));
app.use(express.json()); // Parseia body em JSON

// Rotas Base
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API SaaS Financeiro rodando!' });
});

// Registrar rotas
app.use('/api/auth', authRoutes);
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/organization', require('./src/routes/organizationRoutes'));
app.use('/api/budget', budgetRoutes);
app.use('/api/auxiliary', require('./src/routes/auxiliaryRoutes'));
app.use('/api/investments', require('./src/routes/investmentsRoutes'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
