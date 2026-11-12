const crypto = require('crypto');

function createRateKey(scope, value) {
  return crypto.createHash('sha256').update(`${scope}\0${value}`).digest('hex');
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function checkBlocked(client, keys) {
  const { rows } = await client.query(
    `SELECT MAX(blocked_until) AS blocked_until
     FROM Auth_Rate_Limits
     WHERE rate_key = ANY($1::char(64)[]) AND blocked_until > CURRENT_TIMESTAMP`,
    [keys]
  );
  return rows[0].blocked_until;
}

async function recordFailure(client, key, limit, windowSeconds, blockSeconds) {
  const { rows } = await client.query(
    `INSERT INTO Auth_Rate_Limits (rate_key, window_started_at, attempts)
     VALUES ($1, CURRENT_TIMESTAMP, 1)
     ON CONFLICT (rate_key) DO UPDATE
     SET attempts = CASE
           WHEN Auth_Rate_Limits.window_started_at <= CURRENT_TIMESTAMP - make_interval(secs => $2)
             THEN 1
           ELSE Auth_Rate_Limits.attempts + 1
         END,
         window_started_at = CASE
           WHEN Auth_Rate_Limits.window_started_at <= CURRENT_TIMESTAMP - make_interval(secs => $2)
             THEN CURRENT_TIMESTAMP
           ELSE Auth_Rate_Limits.window_started_at
         END,
         blocked_until = CASE
           WHEN Auth_Rate_Limits.blocked_until > CURRENT_TIMESTAMP
             THEN Auth_Rate_Limits.blocked_until
           WHEN Auth_Rate_Limits.window_started_at <= CURRENT_TIMESTAMP - make_interval(secs => $2)
             THEN NULL
           WHEN Auth_Rate_Limits.attempts + 1 >= $3
             THEN CURRENT_TIMESTAMP + make_interval(secs => $4)
           ELSE NULL
         END
     RETURNING blocked_until`,
    [key, windowSeconds, limit, blockSeconds]
  );
  return rows[0].blocked_until;
}

async function consumeRequest(client, key, limit, windowSeconds, blockSeconds) {
  const blocked = await checkBlocked(client, [key]);
  if (blocked) return blocked;
  return recordFailure(client, key, limit + 1, windowSeconds, blockSeconds);
}

function loginKeys(req, email) {
  return [
    createRateKey('login-email-ip', `${email}\0${getClientIp(req)}`),
    createRateKey('login-ip', getClientIp(req))
  ];
}

async function checkLoginLimit(client, keys) {
  return checkBlocked(client, keys);
}

async function recordLoginFailure(client, keys) {
  let blockedUntil = null;
  for (const [index, key] of keys.entries()) {
    const blocked = await recordFailure(client, key, index === 0 ? 5 : 30, 900, 900);
    if (blocked && (!blockedUntil || blocked > blockedUntil)) blockedUntil = blocked;
  }
  return blockedUntil;
}

module.exports = {
  createRateKey,
  getClientIp,
  consumeRequest,
  loginKeys,
  checkLoginLimit,
  recordLoginFailure
};
