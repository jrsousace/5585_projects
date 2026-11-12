const crypto = require('crypto');
const db = require('../config/db');
const {
  isAccessLevel,
  permissionsForAccessLevel
} = require('../middlewares/permissionMiddleware');

const isValidEmail = (email) =>
  typeof email === 'string' &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function isOwner(req) {
  return req.user.organizationRole === 'owner';
}

async function writeAudit(client, req, action, targetType, targetId, previousState, newState) {
  await client.query(
    `INSERT INTO Auditoria_Organizacao
       (organization_id, actor_user_id, action, target_type, target_id, previous_state, new_state)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      req.user.organizationId,
      req.user.userId,
      action,
      targetType,
      targetId,
      JSON.stringify(previousState || {}),
      JSON.stringify(newState || {})
    ]
  );
}

exports.listMembers = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id_usuario, nome, email, organization_role, access_level,
              email_verified, status_conta, deleted_at
       FROM Usuarios
       WHERE id_organizacao = $1
       ORDER BY organization_role DESC, nome`,
      [req.user.organizationId]
    );
    return res.set('Cache-Control', 'no-store').json(rows);
  } catch (error) {
    console.error('Erro ao listar membros da organização:', error);
    return res.status(500).json({ message: 'Não foi possível carregar os membros.' });
  }
};

exports.createInvitation = async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const accessLevel = body.accessLevel;
  if (!nome || nome.length > 120 || !isValidEmail(email) || !isAccessLevel(accessLevel)) {
    return res.status(400).json({ message: 'Informe nome, e-mail e nível de acesso válidos.' });
  }
  if (!isOwner(req) && accessLevel === 'manager') {
    return res.status(403).json({ message: 'Somente o titular pode designar outro gestor.' });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const publicAppUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(publicAppUrl)) {
    return res.status(503).json({ message: 'A URL pública segura da aplicação não está configurada.' });
  }

  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    await client.query(
      `UPDATE Convites_Organizacao
       SET timestamp_expiracao = CURRENT_TIMESTAMP
       WHERE id_organizacao = $1 AND LOWER(email) = $2
         AND timestamp_aceitacao IS NULL AND timestamp_expiracao <= CURRENT_TIMESTAMP`,
      [req.user.organizationId, email]
    );
    const existingUser = await client.query(
      'SELECT 1 FROM Usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    if (existingUser.rowCount > 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(409).json({ message: 'Este e-mail já possui uma conta.' });
    }

    const { rows } = await client.query(
      `INSERT INTO Convites_Organizacao
         (id_organizacao, email, nome, token_hash, permissions, access_level, criado_por, timestamp_expiracao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP + INTERVAL '72 hours')
       RETURNING id_convite, email, nome, access_level, timestamp_expiracao`,
      [
        req.user.organizationId,
        email,
        nome,
        tokenHash,
        permissionsForAccessLevel(accessLevel),
        accessLevel,
        req.user.userId
      ]
    );
    await writeAudit(
      client,
      req,
      'invitation.created',
      'invitation',
      rows[0].id_convite,
      {},
      { accessLevel, expiresAt: rows[0].timestamp_expiracao }
    );
    await client.query('COMMIT');
    started = false;
    return res.status(201).set('Cache-Control', 'no-store').json({
      invitation: rows[0],
      invitationUrl: `${publicAppUrl}/aceitar-convite?token=${encodeURIComponent(token)}`
    });
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer criação de convite:', rollbackError)
    );
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Já existe um convite pendente para este e-mail.' });
    }
    console.error('Erro ao criar convite da organização:', error);
    return res.status(500).json({ message: 'Não foi possível criar o convite.' });
  } finally {
    if (client) client.release();
  }
};

exports.listInvitations = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id_convite, nome, email, access_level, timestamp_expiracao
       FROM Convites_Organizacao
       WHERE id_organizacao = $1 AND timestamp_aceitacao IS NULL
         AND timestamp_expiracao > CURRENT_TIMESTAMP
       ORDER BY timestamp_criacao DESC`,
      [req.user.organizationId]
    );
    return res.set('Cache-Control', 'no-store').json(rows);
  } catch (error) {
    console.error('Erro ao listar convites pendentes:', error);
    return res.status(500).json({ message: 'Não foi possível carregar os convites pendentes.' });
  }
};

exports.setMemberAccessLevel = async (req, res) => {
  const { memberId } = req.params;
  const accessLevel = req.body?.accessLevel;
  if (!isUuid(memberId) || !isAccessLevel(accessLevel)) {
    return res.status(400).json({ message: 'Identificador ou nível de acesso inválido.' });
  }
  if (!isOwner(req) && accessLevel === 'manager') {
    return res.status(403).json({ message: 'Somente o titular pode designar outro gestor.' });
  }

  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    const current = await client.query(
      `SELECT id_usuario, access_level
       FROM Usuarios
       WHERE id_usuario = $1 AND id_organizacao = $2
         AND organization_role = 'member' AND deleted_at IS NULL
       FOR UPDATE`,
      [memberId, req.user.organizationId]
    );
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({ message: 'Membro não encontrado nesta organização.' });
    }
    if (!isOwner(req) && current.rows[0].access_level === 'manager') {
      await client.query('ROLLBACK');
      started = false;
      return res.status(403).json({ message: 'Gestores não podem alterar o nível de outro gestor.' });
    }
    const { rows } = await client.query(
      `UPDATE Usuarios
       SET access_level = $1, permissions = $2, timestamp_atualizacao = CURRENT_TIMESTAMP
       WHERE id_usuario = $3
       RETURNING id_usuario, access_level`,
      [accessLevel, permissionsForAccessLevel(accessLevel), memberId]
    );
    await writeAudit(
      client,
      req,
      'member.access_level.updated',
      'user',
      memberId,
      { accessLevel: current.rows[0].access_level },
      { accessLevel: rows[0].access_level }
    );
    await client.query('COMMIT');
    started = false;
    return res.set('Cache-Control', 'no-store').json(rows[0]);
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer alteração de acesso:', rollbackError)
    );
    console.error('Erro ao atualizar nível de acesso do membro:', error);
    return res.status(500).json({ message: 'Não foi possível atualizar o nível de acesso.' });
  } finally {
    if (client) client.release();
  }
};

exports.setMemberStatus = async (req, res) => {
  const { memberId } = req.params;
  const active = req.body?.active;
  if (!isUuid(memberId) || typeof active !== 'boolean' || memberId === req.user.userId) {
    return res.status(400).json({ message: 'Identificador ou status inválido.' });
  }

  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    const current = await client.query(
      `SELECT id_usuario, access_level, status_conta, deleted_at
       FROM Usuarios
       WHERE id_usuario = $1 AND id_organizacao = $2
         AND organization_role = 'member'
       FOR UPDATE`,
      [memberId, req.user.organizationId]
    );
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({ message: 'Membro não encontrado nesta organização.' });
    }
    if (!isOwner(req) && current.rows[0].access_level === 'manager') {
      await client.query('ROLLBACK');
      started = false;
      return res.status(403).json({ message: 'Gestores não podem desativar outro gestor.' });
    }
    const { rows } = await client.query(
      `UPDATE Usuarios
       SET status_conta = $1,
           deleted_at = CASE WHEN $2 THEN NULL ELSE CURRENT_TIMESTAMP END,
           token_version = token_version + 1,
           timestamp_atualizacao = CURRENT_TIMESTAMP
       WHERE id_usuario = $3
       RETURNING status_conta, deleted_at`,
      [active ? 'ativo' : 'inativo', active, memberId]
    );
    await writeAudit(
      client,
      req,
      'member.status.updated',
      'user',
      memberId,
      { status: current.rows[0].status_conta, deletedAt: current.rows[0].deleted_at },
      { status: rows[0].status_conta, deletedAt: rows[0].deleted_at }
    );
    await client.query('COMMIT');
    started = false;
    return res.status(204).end();
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer alteração de status do membro:', rollbackError)
    );
    console.error('Erro ao alterar status do membro:', error);
    return res.status(500).json({ message: 'Não foi possível alterar o status do membro.' });
  } finally {
    if (client) client.release();
  }
};

exports.revokeInvitation = async (req, res) => {
  const { invitationId } = req.params;
  if (!isUuid(invitationId)) return res.status(400).json({ message: 'Convite inválido.' });
  let client;
  let started = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    started = true;
    const { rows } = await client.query(
      `UPDATE Convites_Organizacao
       SET timestamp_expiracao = CURRENT_TIMESTAMP
       WHERE id_convite = $1 AND id_organizacao = $2
         AND timestamp_aceitacao IS NULL AND timestamp_expiracao > CURRENT_TIMESTAMP
       RETURNING id_convite, access_level`,
      [invitationId, req.user.organizationId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({ message: 'Convite pendente não encontrado.' });
    }
    await writeAudit(
      client,
      req,
      'invitation.revoked',
      'invitation',
      invitationId,
      { accessLevel: rows[0].access_level, status: 'pending' },
      { status: 'revoked' }
    );
    await client.query('COMMIT');
    started = false;
    return res.status(204).end();
  } catch (error) {
    if (started && client) await client.query('ROLLBACK').catch((rollbackError) =>
      console.error('Erro ao desfazer revogação de convite:', rollbackError)
    );
    console.error('Erro ao revogar convite:', error);
    return res.status(500).json({ message: 'Não foi possível cancelar o convite.' });
  } finally {
    if (client) client.release();
  }
};

exports.listAudit = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.action, a.target_type, a.target_id, a.previous_state,
              a.new_state, a.timestamp_criacao, u.nome AS actor
       FROM Auditoria_Organizacao a
       JOIN Usuarios u ON u.id_usuario = a.actor_user_id
       WHERE a.organization_id = $1
       ORDER BY a.timestamp_criacao DESC
       LIMIT 200`,
      [req.user.organizationId]
    );
    return res.set('Cache-Control', 'no-store').json(rows);
  } catch (error) {
    console.error('Erro ao consultar auditoria da organização:', error);
    return res.status(500).json({ message: 'Não foi possível carregar o histórico de gestão.' });
  }
};
