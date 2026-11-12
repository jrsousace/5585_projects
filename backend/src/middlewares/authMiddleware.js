const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { readSessionCookie } = require('../utils/sessionCookie');

const authMiddleware = async (req, res, next) => {
  const token = readSessionCookie(req);
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    console.error('JWT_SECRET ausente ou menor que 32 bytes.');
    return res.status(500).json({ message: 'Serviço de autenticação indisponível.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return res.status(403).json({ message: 'Token inválido ou expirado.' });
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const allowedOrigins = new Set(
      (process.env.CORS_ALLOWED_ORIGINS || 'https://5585projects.com.br')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    );
    if (!allowedOrigins.has(req.headers.origin)) {
      return res.status(403).json({ message: 'Origem não autorizada para esta operação.' });
    }
  }

  try {
    const { rows } = await db.query(
      `SELECT u.access_role, u.organization_role, u.access_level, u.permissions,
              u.email_verified, u.token_version, u.id_organizacao,
              o.assinatura_plano, o.assinatura_status, o.assinatura_expira_em
       FROM Usuarios u
       JOIN Organizacoes o ON o.id_organizacao = u.id_organizacao
       WHERE u.id_usuario = $1 AND u.status_conta = 'ativo' AND u.deleted_at IS NULL
       LIMIT 1`,
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: 'Conta inativa ou não encontrada.' });
    }
    if (!rows[0].email_verified) {
      return res.status(403).json({ message: 'Confirme seu e-mail antes de usar esta sessão.' });
    }
    if ((decoded.tokenVersion || 0) !== rows[0].token_version) {
      return res.status(403).json({ message: 'Sessão encerrada. Entre novamente.' });
    }

    req.user = {
      ...decoded,
      accessRole: rows[0].access_role,
      organizationId: rows[0].id_organizacao,
      organizationRole: rows[0].organization_role,
      accessLevel: rows[0].access_level,
      permissions: rows[0].permissions,
      plan: rows[0].assinatura_plano,
      subscriptionStatus: rows[0].assinatura_status,
      subscriptionExpiresAt: rows[0].assinatura_expira_em
    };
    return next();
  } catch (error) {
    console.error('Erro ao validar status da conta:', error);
    return res.status(500).json({ message: 'Não foi possível validar a conta.' });
  }
};

module.exports = authMiddleware;
