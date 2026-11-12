const crypto = require('crypto');

async function createAuthToken(client, userId, purpose) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const validity = purpose === 'verify_email' ? '24 hours' : '30 minutes';
  await client.query(
    `UPDATE Auth_Tokens
     SET used_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose]
  );
  await client.query(
    `INSERT INTO Auth_Tokens (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + $4::interval)`,
    [userId, tokenHash, purpose, validity]
  );
  return token;
}

function hashAuthToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { createAuthToken, hashAuthToken };
