require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationName = '003_subscription_lifecycle';

async function migrateSubscription() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  let transactionStarted = false;

  try {
    await client.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock($1)', [5585]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS Schema_Migrations (
         migration_name VARCHAR(120) PRIMARY KEY,
         applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`
    );

    const applied = await client.query(
      'SELECT 1 FROM Schema_Migrations WHERE migration_name = $1',
      [migrationName]
    );
    if (applied.rowCount > 0) {
      await client.query('COMMIT');
      transactionStarted = false;
      console.log(`Migração ${migrationName} já aplicada.`);
      return;
    }

    const migration = fs.readFileSync(path.join(__dirname, 'subscription-migration.sql'), 'utf8');
    await client.query(migration);
    await client.query('INSERT INTO Schema_Migrations (migration_name) VALUES ($1)', [migrationName]);
    await client.query('COMMIT');
    transactionStarted = false;
    console.log(`Migração ${migrationName} aplicada com sucesso.`);
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao desfazer migração de assinatura:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

migrateSubscription().catch((error) => {
  console.error('Falha ao aplicar migração de assinatura:', error.message);
  process.exitCode = 1;
});
