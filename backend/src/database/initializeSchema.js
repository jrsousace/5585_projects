const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function initializeSchema() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await client.connect();
  let transactionStarted = false;

  try {
    const existingTables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    if (existingTables.rows.length > 0) {
      throw new Error(
        `O banco já contém tabelas públicas (${existingTables.rows.map((row) => row.table_name).join(', ')}); nenhuma alteração foi aplicada.`
      );
    }

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(schema);
    await client.query('COMMIT');
    transactionStarted = false;

    const createdTables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    console.log(`Schema inicializado. Tabelas criadas: ${createdTables.rows.map((row) => row.table_name).join(', ')}`);
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao desfazer inicialização do schema:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

initializeSchema().catch((error) => {
  console.error('Falha ao inicializar schema:', error.message);
  process.exitCode = 1;
});
