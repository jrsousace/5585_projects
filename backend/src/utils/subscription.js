function buildSubscription(organization) {
  const plan = organization.assinatura_plano || 'basic';
  const expiresAt = organization.assinatura_expira_em
    ? new Date(organization.assinatura_expira_em).toISOString()
    : null;
  const active = plan === 'pro' &&
    organization.assinatura_status === 'active' &&
    expiresAt !== null &&
    Date.parse(expiresAt) > Date.now();
  const status = organization.assinatura_status || 'free';

  return {
    plan,
    status: status === 'active' && !active ? 'expired' : status,
    active,
    expiresAt,
    modules: plan === 'pro' ? ['budget', 'investments'] : []
  };
}

module.exports = { buildSubscription };
