const db = require('../config/db');
const { buildSubscription } = require('../utils/subscription');
const { getStripeConfiguration, verifyStripeSignature } = require('../utils/stripe');

async function stripeRequest(config, endpoint, body, idempotencyKey, method = 'POST') {
  const headers = {
    Authorization: `Bearer ${config.secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers,
    ...(body ? { body: new URLSearchParams(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `Stripe retornou HTTP ${response.status}.`);
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return result;
}

exports.createCheckout = async (req, res) => {
  const interval = req.body?.interval;
  if (!['month', 'year'].includes(interval)) {
    return res.status(400).json({ message: 'Selecione uma periodicidade válida.' });
  }

  let config;
  try {
    config = getStripeConfiguration();
  } catch (error) {
    console.error('Configuração Stripe incompleta:', error.message);
    return res.status(503).json({ message: 'A contratação online ainda não está configurada.' });
  }
  const priceId = interval === 'month' ? config.monthlyPriceId : config.annualPriceId;
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) {
    return res.status(503).json({ message: 'O preço selecionado ainda não está configurado.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT o.id_organizacao, o.stripe_customer_id, o.assinatura_plano,
              o.assinatura_status, o.assinatura_expira_em,
              u.email, u.nome
       FROM Usuarios u
       JOIN Organizacoes o ON o.id_organizacao = u.id_organizacao
       WHERE u.id_usuario = $1 AND u.status_conta = 'ativo' AND u.deleted_at IS NULL
       LIMIT 1`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(403).json({ message: 'Conta não encontrada.' });

    const account = rows[0];
    if (req.user.organizationRole !== 'owner') {
      return res.status(403).json({ message: 'Apenas o titular pode contratar uma assinatura.' });
    }
    if (account.assinatura_plano === 'pro' &&
        account.assinatura_status === 'active' &&
        account.assinatura_expira_em &&
        new Date(account.assinatura_expira_em).getTime() > Date.now()) {
      return res.status(409).json({ message: 'Esta organização já possui uma assinatura PRO.' });
    }

    const appUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
    if (!/^https:\/\//i.test(appUrl)) {
      return res.status(503).json({ message: 'A URL pública segura da aplicação não está configurada.' });
    }

    const params = {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'client_reference_id': account.id_organizacao,
      'metadata[organizationId]': account.id_organizacao,
      'metadata[interval]': interval,
      'subscription_data[metadata][organizationId]': account.id_organizacao,
      'subscription_data[metadata][interval]': interval,
      success_url: `${appUrl}/financas?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/financas?checkout=cancel`
    };
    if (account.stripe_customer_id) params.customer = account.stripe_customer_id;
    else params.customer_email = account.email;

    const checkout = await stripeRequest(
      config,
      'checkout/sessions',
      params,
      `checkout-${account.id_organizacao}-${interval}-${Math.floor(Date.now() / 60_000)}`
    );
    if (!checkout.url || !/^https:\/\/checkout\.stripe\.com\//i.test(checkout.url)) {
      throw new Error('Stripe não retornou uma URL de checkout válida.');
    }
    return res.set('Cache-Control', 'no-store').json({ url: checkout.url });
  } catch (error) {
    console.error('Erro ao criar checkout Stripe:', error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Não foi possível iniciar o checkout.'
    });
  }
};

exports.cancelSubscription = async (req, res) => {
  let config;
  try {
    config = getStripeConfiguration();
  } catch (error) {
    console.error('Configuração Stripe incompleta:', error.message);
    return res.status(503).json({ message: 'A gestão de cobranças ainda não está configurada.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT o.stripe_subscription_id, o.assinatura_status
       FROM Organizacoes o
       WHERE o.id_organizacao = $1`,
      [req.user.organizationId]
    );
    if (rows.length === 0 || !rows[0].stripe_subscription_id) {
      return res.status(409).json({ message: 'Não há assinatura online para cancelar.' });
    }
    if (rows[0].assinatura_status !== 'active') {
      return res.status(409).json({ message: 'Não há assinatura ativa para cancelar.' });
    }

    const subscription = await stripeRequest(
      config,
      `subscriptions/${encodeURIComponent(rows[0].stripe_subscription_id)}`,
      { cancel_at_period_end: 'true' },
      `cancel-${rows[0].stripe_subscription_id}`
    );
    return res.set('Cache-Control', 'no-store').json({
      message: 'Cancelamento agendado para o fim do período já pago.',
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null
    });
  } catch (error) {
    console.error('Erro ao agendar cancelamento Stripe:', error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Não foi possível agendar o cancelamento.'
    });
  }
};

async function updateFromSubscription(client, subscription, eventId, eventType) {
  const organizationId = subscription.metadata?.organizationId;
  const subscriptionId = subscription.id;
  if (!organizationId || !subscriptionId) {
    throw new Error(`Evento ${eventId} sem organizationId ou subscriptionId associados.`);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
    throw new Error(`Evento ${eventId} tem organizationId inválido.`);
  }

  const current = await client.query(
    `SELECT assinatura_plano, assinatura_status, assinatura_expira_em,
            stripe_subscription_id
     FROM Organizacoes WHERE id_organizacao = $1 FOR UPDATE`,
    [organizationId]
  );
  if (current.rowCount === 0) throw new Error(`Organização do evento ${eventId} não encontrada.`);
  if (current.rows[0].stripe_subscription_id &&
      current.rows[0].stripe_subscription_id !== subscriptionId) {
    const currentSubscriptionIsActive =
      current.rows[0].assinatura_plano === 'pro' &&
      current.rows[0].assinatura_status === 'active' &&
      current.rows[0].assinatura_expira_em &&
      new Date(current.rows[0].assinatura_expira_em).getTime() > Date.now();
    if (currentSubscriptionIsActive) return;
  }
  if (current.rows[0].assinatura_plano === 'basic' &&
      current.rows[0].stripe_subscription_id === subscriptionId) {
    return;
  }

  const periodEndSeconds = Number(subscription.current_period_end);
  const expiresAt = Number.isSafeInteger(periodEndSeconds) && periodEndSeconds > 0
    ? new Date(periodEndSeconds * 1000)
    : null;
  const active = subscription.status === 'active' &&
    expiresAt !== null &&
    expiresAt.getTime() > Date.now();
  const status = active
    ? 'active'
    : subscription.status === 'canceled' || subscription.status === 'unpaid'
      ? 'canceled'
      : 'expired';

  const { rows } = await client.query(
    `UPDATE Organizacoes
     SET assinatura_plano = 'pro',
         assinatura_status = $1,
         assinatura_expira_em = $2,
         stripe_customer_id = NULLIF($3, ''),
         stripe_subscription_id = $4
     WHERE id_organizacao = $5
     RETURNING assinatura_plano, assinatura_status, assinatura_expira_em`,
    [status, expiresAt, String(subscription.customer || ''), subscriptionId, organizationId]
  );
  if (rows.length === 0) throw new Error(`Organização do evento ${eventId} não encontrada.`);

  await client.query(
    `INSERT INTO Admin_Auditoria_Assinaturas
       (organization_id, admin_user_id, origem, acao, estado_anterior, estado_novo)
     SELECT $1, u.id_usuario, 'stripe', $2, $3::jsonb, $4::jsonb
     FROM Usuarios u
     WHERE u.id_organizacao = $1 AND u.organization_role = 'owner'
     ORDER BY u.timestamp_criacao
     LIMIT 1`,
    [
      organizationId,
      eventType,
      JSON.stringify({
        plan: current.rows[0].assinatura_plano,
        status: current.rows[0].assinatura_status,
        stripeSubscriptionId: current.rows[0].stripe_subscription_id
      }),
      JSON.stringify({
        plan: rows[0].assinatura_plano,
        status: rows[0].assinatura_status,
        expiresAt: rows[0].assinatura_expira_em,
        stripeSubscriptionId: subscriptionId
      })
    ]
  );
}

exports.webhook = async (req, res) => {
  let config;
  try {
    config = getStripeConfiguration();
  } catch (error) {
    console.error('Configuração Stripe incompleta:', error.message);
    return res.status(503).json({ message: 'Webhook de pagamentos não está configurado.' });
  }

  if (!Buffer.isBuffer(req.body) ||
      !verifyStripeSignature(req.body, req.headers['stripe-signature'], config.webhookSecret)) {
    return res.status(400).json({ message: 'Assinatura Stripe inválida.' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Payload Stripe inválido.' });
  }
  if (!event.id || !event.type || !event.data?.object) {
    return res.status(400).json({ message: 'Estrutura do evento Stripe inválida.' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const insertedEvent = await client.query(
      `INSERT INTO Stripe_Eventos (event_id, event_type)
       VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.type]
    );
    if (insertedEvent.rowCount === 0) {
      await client.query('COMMIT');
      transactionStarted = false;
      return res.json({ received: true, duplicate: true });
    }

    if (event.type.startsWith('customer.subscription.')) {
      const subscription = await stripeRequest(
        config,
        `subscriptions/${encodeURIComponent(event.data.object.id)}`,
        null,
        null,
        'GET'
      );
      await updateFromSubscription(client, subscription, event.id, event.type);
    } else if (event.type === 'checkout.session.completed' &&
      event.data.object.mode === 'subscription' &&
      event.data.object.subscription &&
      event.data.object.metadata?.organizationId) {
      const updated = await client.query(
        `UPDATE Organizacoes
         SET stripe_customer_id = COALESCE(stripe_customer_id, NULLIF($1, ''))
         WHERE id_organizacao = $2`,
        [String(event.data.object.customer || ''), event.data.object.metadata.organizationId]
      );
      if (updated.rowCount === 0) {
        throw new Error(`Organização do checkout ${event.id} não encontrada.`);
      }
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return res.json({ received: true });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao desfazer evento Stripe:', rollbackError);
      }
    }
    console.error(`Erro ao processar evento Stripe ${event.id}:`, error);
    return res.status(500).json({ message: 'Não foi possível processar o evento de pagamento.' });
  } finally {
    if (client) client.release();
  }
};
