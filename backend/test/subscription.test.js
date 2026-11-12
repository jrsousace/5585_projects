const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSubscription } = require('../src/utils/subscription');

test('only an unexpired pro subscription enables cloud storage', () => {
  const subscription = buildSubscription({
    assinatura_plano: 'pro',
    assinatura_status: 'active',
    assinatura_expira_em: new Date(Date.now() + 60_000)
  });
  assert.equal(subscription.active, true);
  assert.deepEqual(subscription.modules, ['budget', 'investments']);
});

test('expired, missing-expiry, and free subscriptions do not enable cloud storage', () => {
  assert.equal(buildSubscription({
    assinatura_plano: 'pro',
    assinatura_status: 'expired',
    assinatura_expira_em: new Date(Date.now() - 60_000)
  }).active, false);
  assert.equal(buildSubscription({
    assinatura_plano: 'pro',
    assinatura_status: 'active',
    assinatura_expira_em: null
  }).active, false);
  assert.equal(buildSubscription({
    assinatura_plano: 'basic',
    assinatura_status: 'free',
    assinatura_expira_em: null
  }).active, false);
});

test('an active database status with a past expiry is exposed as expired', () => {
  const subscription = buildSubscription({
    assinatura_plano: 'pro',
    assinatura_status: 'active',
    assinatura_expira_em: new Date(Date.now() - 60_000)
  });
  assert.equal(subscription.status, 'expired');
  assert.equal(subscription.active, false);
});
