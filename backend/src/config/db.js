const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const connectToDB = async () => {
  try {
    await pool.connect();
    console.log('Conectado ao PostgreSQL');
  } catch (err) {
    console.error('Aviso: Falha ao conectar no banco no arranque inicial:', err.message);
    // Opcional: tentar nova ligação após alguns segundos (retry logic)
  }
};

connectToDB();

pool.on('error', (err) => {
  console.error('Erro inesperado no cliente do PostgreSQL', err);
});

module.exports = pool;