const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { getStripeConfiguration, verifyStripeSignature } = require('../src/utils/stripe');

test('Stripe signatures must match the raw payload and a recent timestamp', () => {
  const payload = Buffer.from('{"id":"evt_test","type":"test.event"}');
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = 'whsec_test_secret';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest('hex');

  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret), true);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${'0'.repeat(64)}`, secret), false);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp - 301},v1=${signature}`, secret), false);
  assert.equal(verifyStripeSignature(Buffer.from('different'), `t=${timestamp},v1=${signature}`, secret), false);
});

test('Stripe configuration rejects key mode mismatches and returns sandbox prices', () => {
  const keys = [
    'STRIPE_MODE',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRO_MONTHLY_PRICE_ID',
    'STRIPE_PRO_ANNUAL_PRICE_ID'
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.STRIPE_MODE = 'test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_sample';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_sample';
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_monthly';
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID = 'price_annual';

    assert.deepEqual(getStripeConfiguration(), {
      mode: 'test',
      secretKey: 'sk_test_sample',
      webhookSecret: 'whsec_sample',
      monthlyPriceId: 'price_monthly',
      annualPriceId: 'price_annual'
    });

    process.env.STRIPE_SECRET_KEY = 'sk_live_sample';
    assert.throws(() => getStripeConfiguration(), /test exige uma chave sk_test_/);
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
});
