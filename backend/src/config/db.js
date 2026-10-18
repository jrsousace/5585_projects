const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no cliente do PostgreSQL', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

const { Pool } = require('pg');

// O Pool gerencia múltiplas conexões simultâneas de usuários no seu SaaS
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;