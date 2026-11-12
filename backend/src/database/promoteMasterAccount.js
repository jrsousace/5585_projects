
const { Client } = require('pg');

async function promoteMasterAccount() {
  const email = process.env.MASTER_ACCOUNT_EMAIL;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('MASTER_ACCOUNT_EMAIL ausente ou inválido.');
  }

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
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(
      `ALTER TABLE Usuarios
       ADD COLUMN IF NOT EXISTS access_role VARCHAR(20) NOT NULL DEFAULT 'user'`
    );
    await client.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'usuarios_access_role_check'
             AND conrelid = 'usuarios'::regclass
         ) THEN
           ALTER TABLE Usuarios
             ADD CONSTRAINT usuarios_access_role_check
             CHECK (access_role IN ('user', 'master'));
         END IF;
       END
       $$`
    );

    const accounts = await client.query(
      'SELECT id_usuario FROM Usuarios WHERE LOWER(email) = LOWER($1) FOR UPDATE',
      [email.trim()]
    );
    if (accounts.rows.length !== 1) {
      throw new Error(
        accounts.rows.length === 0
          ? 'Nenhuma conta corresponde ao e-mail informado; nenhuma alteração foi aplicada.'
          : 'Mais de uma conta corresponde ao e-mail; nenhuma alteração foi aplicada.'
      );
    }

    await client.query(
      "UPDATE Usuarios SET access_role = 'master' WHERE id_usuario = $1",
      [accounts.rows[0].id_usuario]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    console.log('Perfil master configurado para uma única conta.');
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao desfazer promoção da conta:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

promoteMasterAccount().catch((error) => {
  console.error('Falha ao configurar conta master:', error.message);
  process.exitCode = 1;
});
