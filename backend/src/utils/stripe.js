const crypto = require('crypto');

function getStripeConfiguration() {
  const mode = process.env.STRIPE_MODE || 'test';
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!['test', 'live'].includes(mode)) throw new Error('STRIPE_MODE deve ser test ou live.');
  if (mode === 'test' && !secretKey.startsWith('sk_test_')) {
    throw new Error('O modo Stripe test exige uma chave sk_test_.');
  }
  if (mode === 'live' && !secretKey.startsWith('sk_live_')) {
    throw new Error('O modo Stripe live exige uma chave sk_live_.');
  }
  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error('Configure um segredo de webhook Stripe válido.');
  }

  return {
    mode,
    secretKey,
    webhookSecret,
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || ''
  };
}

function verifyStripeSignature(payload, signatureHeader, secret, now = Date.now()) {
  if (!Buffer.isBuffer(payload) || typeof signatureHeader !== 'string' || !secret) return false;
  const parts = signatureHeader.split(',').map((part) => part.split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
}

module.exports = { getStripeConfiguration, verifyStripeSignature };
