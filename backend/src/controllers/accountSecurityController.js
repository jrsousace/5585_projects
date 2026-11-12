const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { createAuthToken, hashAuthToken } = require('../utils/authTokens');
const {
  getEmailConfiguration,
  sendPasswordResetEmail,
  sendVerificationEmail
} = require('../utils/emailService');
const { consumeRequest, createRateKey, getClientIp } = require('../utils/loginRateLimit');

const genericRequestMessage =
  'Se a conta puder receber esta mensagem, enviaremos um link para o e-mail informado.';

function isValidEmail(email) {
  return typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(token);
}

function validatePassword(password) {
  return typeof password === 'string' &&
    [...password].length >= 12 &&
    Buffer.byteLength(password, 'utf8') <= 72;
}

exports.verifyEmail = async (req, res) => {
  const token = req.body?.token;
  if (!isValidToken(token)) {
    return res.status(400).json({ message: 'Link de confirmação inválido ou expirado.' });
  }
  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    const tokenHash = hashAuthToken(token);
    const { rows } = await client.query(
      `SELECT t.id_token, t.user_id, u.email_verified
       FROM Auth_Tokens t
       JOIN Usuarios u ON u.id_usuario = t.user_id
       WHERE t.token_hash = $1 AND t.purpose = 'verify_email'
         AND t.used_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP
       FOR UPDATE OF t, u`,
      [tokenHash]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(400).json({ message: 'Link de confirmação inválido ou expirado.' });
    }
    await client.query(
      `UPDATE Usuarios SET email_verified = TRUE
       WHERE id_usuario = $1`,
      [rows[0].user_id]
    );
    await client.query(
      `UPDATE Auth_Tokens SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND purpose = 'verify_email' AND used_at IS NULL`,
      [rows[0].user_id]
    );
    await client.query('COMMIT');
    started = false;
    return res.set('Cache-Control', 'no-store').json({
      message: rows[0].email_verified ? 'E-mail já confirmado.' : 'E-mail confirmado. Você já pode entrar.'
    });
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer confirmação de e-mail:', rollbackError)
    );
    console.error('Erro ao confirmar e-mail:', error);
    return res.status(500).json({ message: 'Não foi possível confirmar o e-mail.' });
  } finally {
    if (client) client.release();
  }
};

exports.resendVerification = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  let client;
  let started = false;
  let token;
  let account;
  try {
    getEmailConfiguration();
    client = await db.connect();
    const blockedUntil = await consumeRequest(client, createRateKey('verify-email', getClientIp(req)), 3, 900, 900);
    if (blockedUntil) {
      return res.status(429).set('Retry-After', String(Math.ceil((blockedUntil - Date.now()) / 1000)))
        .json({ message: 'Muitas solicitações. Aguarde antes de tentar novamente.' });
    }
    const result = await client.query(
      `SELECT id_usuario, nome, email, email_verified
       FROM Usuarios WHERE LOWER(email) = $1 AND status_conta = 'ativo' AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    if (result.rows.length && !result.rows[0].email_verified) {
      account = result.rows[0];
      await client.query('BEGIN');
      started = true;
      token = await createAuthToken(client, account.id_usuario, 'verify_email');
      await client.query('COMMIT');
      started = false;
    }
    client.release();
    client = null;
    if (account) await sendVerificationEmail(account.email, account.nome, token);
    return res.set('Cache-Control', 'no-store').json({ message: genericRequestMessage });
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer reenvio de confirmação:', rollbackError)
    );
    console.error('Falha ao reenviar confirmação de e-mail:', error.message);
    return res.status(503).json({ message: 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.' });
  } finally {
    if (client) client.release();
  }
};

exports.requestPasswordReset = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  let client;
  let started = false;
  let token;
  let account;
  try {
    getEmailConfiguration();
    client = await db.connect();
    const blockedUntil = await consumeRequest(client, createRateKey('password-reset', getClientIp(req)), 3, 900, 900);
    if (blockedUntil) {
      return res.status(429).set('Retry-After', String(Math.ceil((blockedUntil - Date.now()) / 1000)))
        .json({ message: 'Muitas solicitações. Aguarde antes de tentar novamente.' });
    }
    const result = await client.query(
      `SELECT id_usuario, nome, email
       FROM Usuarios
       WHERE LOWER(email) = $1 AND email_verified = TRUE
         AND status_conta = 'ativo' AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    if (result.rows.length) {
      account = result.rows[0];
      await client.query('BEGIN');
      started = true;
      token = await createAuthToken(client, account.id_usuario, 'reset_password');
      await client.query('COMMIT');
      started = false;
    }
    client.release();
    client = null;
    if (account) await sendPasswordResetEmail(account.email, account.nome, token);
    return res.set('Cache-Control', 'no-store').json({ message: genericRequestMessage });
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer solicitação de redefinição:', rollbackError)
    );
    console.error('Falha ao solicitar redefinição de senha:', error.message);
    return res.status(503).json({ message: 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.' });
  } finally {
    if (client) client.release();
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (!isValidToken(token) || !validatePassword(password)) {
    return res.status(400).json({ message: 'Link inválido ou senha fora dos critérios exigidos.' });
  }
  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    const { rows } = await client.query(
      `SELECT id_token, user_id
       FROM Auth_Tokens
       WHERE token_hash = $1 AND purpose = 'reset_password'
         AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [hashAuthToken(token)]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(400).json({ message: 'Link inválido ou expirado. Solicite uma nova redefinição.' });
    }
    const userId = rows[0].user_id;
    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await client.query(
      `UPDATE Usuarios
       SET senha_hash = $1, token_version = token_version + 1,
           timestamp_atualizacao = CURRENT_TIMESTAMP
       WHERE id_usuario = $2 AND status_conta = 'ativo' AND deleted_at IS NULL
       RETURNING id_usuario`,
      [passwordHash, userId]
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(400).json({ message: 'Link inválido ou expirado. Solicite uma nova redefinição.' });
    }
    await client.query(
      'UPDATE Auth_Tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    await client.query('COMMIT');
    started = false;
    return res.set('Cache-Control', 'no-store').json({
      message: 'Senha atualizada. Entre novamente com a nova senha.'
    });
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer redefinição de senha:', rollbackError)
    );
    console.error('Erro ao redefinir senha:', error);
    return res.status(500).json({ message: 'Não foi possível redefinir a senha.' });
  } finally {
    if (client) client.release();
  }
};

exports.changePassword = async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!currentPassword || !validatePassword(newPassword)) {
    return res.status(400).json({ message: 'Informe a senha atual e uma nova senha com ao menos 12 caracteres.' });
  }
  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    const { rows } = await client.query(
      `SELECT senha_hash FROM Usuarios
       WHERE id_usuario = $1 AND status_conta = 'ativo' AND deleted_at IS NULL
       FOR UPDATE`,
      [req.user.userId]
    );
    if (!rows.length || !await bcrypt.compare(currentPassword, rows[0].senha_hash)) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(400).json({ message: 'Senha atual incorreta.' });
    }
    await client.query(
      `UPDATE Usuarios
       SET senha_hash = $1, token_version = token_version + 1,
           timestamp_atualizacao = CURRENT_TIMESTAMP
       WHERE id_usuario = $2`,
      [await bcrypt.hash(newPassword, 12), req.user.userId]
    );
    await client.query(
      'UPDATE Auth_Tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
      [req.user.userId]
    );
    await client.query('COMMIT');
    started = false;
    return res.set('Cache-Control', 'no-store').json({
      message: 'Senha alterada. Entre novamente para continuar.'
    });
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer alteração de senha:', rollbackError)
    );
    console.error('Erro ao alterar senha:', error);
    return res.status(500).json({ message: 'Não foi possível alterar a senha.' });
  } finally {
    if (client) client.release();
  }
};
