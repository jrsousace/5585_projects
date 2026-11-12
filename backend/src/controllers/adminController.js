const db = require('../config/db');
const { buildSubscription } = require('../utils/subscription');

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

exports.listOrganizations = async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const { rows } = await db.query(
      `SELECT o.id_organizacao, o.nome, o.tipo_cadastro, o.cnpj, o.razao_social,
              o.nome_fantasia, o.assinatura_plano, o.assinatura_status,
              o.assinatura_expira_em, o.timestamp_criacao,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id_usuario,
                    'name', u.nome,
                    'email', u.email,
                    'role', u.organization_role,
                    'status', u.status_conta
                  ) ORDER BY u.organization_role DESC, u.nome
                ) FILTER (WHERE u.id_usuario IS NOT NULL),
                '[]'::json
              ) AS users
       FROM Organizacoes o
       LEFT JOIN Usuarios u ON u.id_organizacao = o.id_organizacao
       WHERE $1 = '' OR
         o.nome ILIKE '%' || $1 || '%' OR
         o.razao_social ILIKE '%' || $1 || '%' OR
         u.nome ILIKE '%' || $1 || '%' OR
         u.email ILIKE '%' || $1 || '%'
       GROUP BY o.id_organizacao
       ORDER BY o.timestamp_criacao DESC
       LIMIT 200`,
      [search]
    );
    return res.set('Cache-Control', 'no-store').json(rows);
  } catch (error) {
    console.error('Erro ao listar organizações para master:', error);
    return res.status(500).json({ message: 'Não foi possível carregar as organizações.' });
  }
};

exports.setUserStatus = async (req, res) => {
  const { userId } = req.params;
  const active = req.body?.active;
  if (!isUuid(userId) || typeof active !== 'boolean' || userId === req.user.userId) {
    return res.status(400).json({ message: 'Identificador ou status de usuário inválido.' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const current = await client.query(
      `SELECT id_organizacao, status_conta, organization_role, deleted_at
       FROM Usuarios WHERE id_usuario = $1 FOR UPDATE`,
      [userId]
    );
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    await client.query(
      'SELECT id_organizacao FROM Organizacoes WHERE id_organizacao = $1 FOR UPDATE',
      [current.rows[0].id_organizacao]
    );
    if (!active &&
        current.rows[0].organization_role === 'owner' &&
        current.rows[0].status_conta === 'ativo' &&
        !current.rows[0].deleted_at) {
      const owners = await client.query(
        `SELECT COUNT(*) AS count
         FROM Usuarios
         WHERE id_organizacao = $1
           AND organization_role = 'owner'
           AND status_conta = 'ativo'
           AND deleted_at IS NULL`,
        [current.rows[0].id_organizacao]
      );
      if (Number(owners.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(409).json({
          message: 'Não é possível desativar o último titular ativo da organização.'
        });
      }
    }
    const updated = await client.query(
      `UPDATE Usuarios
       SET status_conta = $1,
           deleted_at = CASE WHEN $2 THEN NULL ELSE CURRENT_TIMESTAMP END,
           token_version = token_version + 1,
           timestamp_atualizacao = CURRENT_TIMESTAMP
       WHERE id_usuario = $3
       RETURNING id_usuario, id_organizacao, status_conta`,
      [active ? 'ativo' : 'inativo', active, userId]
    );
    await client.query(
      `INSERT INTO Admin_Auditoria_Usuarios
         (organization_id, target_user_id, admin_user_id, status_anterior, status_novo)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        current.rows[0].id_organizacao,
        userId,
        req.user.userId,
        current.rows[0].status_conta,
        updated.rows[0].status_conta
      ]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return res.status(204).end();
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao desfazer alteração master de usuário:', rollbackError);
      }
    }
    console.error('Erro ao alterar status de usuário pela conta master:', error);
    return res.status(500).json({ message: 'Não foi possível alterar o status do usuário.' });
  } finally {
    if (client) client.release();
  }
};

exports.listOrganizationAudit = async (req, res) => {
  const { organizationId } = req.params;
  if (!isUuid(organizationId)) {
    return res.status(400).json({ message: 'Identificador de organização inválido.' });
  }
  try {
    const { rows } = await db.query(
      `SELECT type, action, actor, previous_state, new_state, created_at
       FROM (
         SELECT 'subscription'::text AS type, a.acao AS action,
                CASE WHEN a.origem = 'stripe' THEN 'Stripe (automação)' ELSE u.email END AS actor,
                a.estado_anterior AS previous_state,
                a.estado_novo AS new_state, a.timestamp_criacao AS created_at
         FROM Admin_Auditoria_Assinaturas a
         JOIN Usuarios u ON u.id_usuario = a.admin_user_id
         WHERE a.organization_id = $1
         UNION ALL
         SELECT 'user'::text, 'user.status.updated', admin.email,
                jsonb_build_object('status', a.status_anterior),
                jsonb_build_object('status', a.status_novo, 'userId', a.target_user_id),
                a.timestamp_criacao
         FROM Admin_Auditoria_Usuarios a
         JOIN Usuarios admin ON admin.id_usuario = a.admin_user_id
         WHERE a.organization_id = $1
       ) audit
       ORDER BY created_at DESC
       LIMIT 100`,
      [organizationId]
    );
    return res.set('Cache-Control', 'no-store').json(rows);
  } catch (error) {
    console.error('Erro ao consultar auditoria da organização:', error);
    return res.status(500).json({ message: 'Não foi possível carregar a auditoria.' });
  }
};

exports.setOrganizationSubscription = async (req, res) => {
  const { organizationId } = req.params;
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const plan = body.plan;
  const status = body.status;
  const expiresAt = body.expiresAt === null ? null : body.expiresAt;

  if (!isUuid(organizationId)) {
    return res.status(400).json({ message: 'Identificador de organização inválido.' });
  }
  if (plan === 'basic') {
    if (status !== 'free' || expiresAt !== null) {
      return res.status(400).json({ message: 'O plano gratuito deve usar status free e sem validade.' });
    }
  } else if (plan === 'pro') {
    if (!['active', 'expired', 'canceled'].includes(status)) {
      return res.status(400).json({ message: 'Status de assinatura inválido.' });
    }
    if (status === 'active' &&
      (typeof expiresAt !== 'string' ||
       !/(?:Z|[+-]\d{2}:\d{2})$/i.test(expiresAt) ||
       !Number.isFinite(Date.parse(expiresAt)) ||
       Date.parse(expiresAt) <= Date.now())) {
      return res.status(400).json({ message: 'Informe uma validade futura com fuso horário para ativar o plano PRO.' });
    }
    if (status !== 'active' && expiresAt !== null &&
      (typeof expiresAt !== 'string' ||
       !/(?:Z|[+-]\d{2}:\d{2})$/i.test(expiresAt) ||
       !Number.isFinite(Date.parse(expiresAt)))) {
      return res.status(400).json({ message: 'Data de validade inválida.' });
    }
  } else {
    return res.status(400).json({ message: 'Plano inválido.' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const current = await client.query(
      `SELECT assinatura_plano, assinatura_status, assinatura_expira_em
       FROM Organizacoes WHERE id_organizacao = $1 FOR UPDATE`,
      [organizationId]
    );
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ message: 'Organização não encontrada.' });
    }

    const { rows } = await client.query(
      `UPDATE Organizacoes
       SET assinatura_plano = $1,
           assinatura_status = $2,
           assinatura_expira_em = $3
       WHERE id_organizacao = $4
       RETURNING assinatura_plano, assinatura_status, assinatura_expira_em`,
      [plan, status, expiresAt, organizationId]
    );
    await client.query(
      `INSERT INTO Admin_Auditoria_Assinaturas
         (organization_id, admin_user_id, origem, acao, estado_anterior, estado_novo)
       VALUES ($1, $2, 'master', 'subscription.updated', $3::jsonb, $4::jsonb)`,
      [
        organizationId,
        req.user.userId,
        JSON.stringify(current.rows[0]),
        JSON.stringify(rows[0])
      ]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return res.set('Cache-Control', 'no-store').json({
      subscription: buildSubscription(rows[0])
    });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao desfazer alteração master da assinatura:', rollbackError);
      }
    }
    console.error('Erro ao alterar assinatura da organização:', error);
    return res.status(500).json({ message: 'Não foi possível alterar a assinatura.' });
  } finally {
    if (client) client.release();
  }
};
