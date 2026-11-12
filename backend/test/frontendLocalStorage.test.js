const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const storeSource = fs.readFileSync(
  path.join(__dirname, '../../frontend/js/store.js'),
  'utf8'
) + '\nglobalThis.appStateUnderTest = appState;';

function createStore(user) {
  const values = new Map([
    ['sessionExpiresAt', new Date(Date.now() + 60_000).toISOString()],
    ['userData', JSON.stringify(user)]
  ]);
  let fetchCalls = 0;
  const context = {
    CONFIG: { API_BASE_URL: 'https://api.example.test/api', USE_MOCKS: false },
    getActiveSession: () => ({
      expiresAt: Date.parse(values.get('sessionExpiresAt')),
      user
    }),
    localStorage: {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    },
    fetch: async () => {
      fetchCalls += 1;
      throw new Error('Unexpected cloud request');
    },
    crypto: webcrypto
  };
  vm.runInNewContext(storeSource, context);
  context.appStateUnderTest.init();
  return { appState: context.appStateUnderTest, values, getFetchCalls: () => fetchCalls };
}

test('free account transaction data stays in organization-scoped local storage', async () => {
  const { appState, values, getFetchCalls } = createStore({
    id: 'user-id',
    organizationId: 'organization-id',
    accessRole: 'user',
    organizationRole: 'owner',
    subscription: { plan: 'basic', active: false, modules: [] }
  });

  const transaction = await appState.fetchAuth('/budget/transactions', {
    method: 'POST',
    body: JSON.stringify({ descricao: 'Teste local', valor_total: 12.5 })
  });
  const transactions = await appState.fetchAuth('/budget/transactions');

  assert.equal(transaction.descricao, 'Teste local');
  assert.equal(JSON.parse(JSON.stringify(transactions))[0].id_transacao, transaction.id_transacao);
  assert.equal(values.has('5585:local:organization-id:finance'), true);
  assert.equal(getFetchCalls(), 0);
});

test('expired pro account cannot write cloud data', async () => {
  const { appState, getFetchCalls } = createStore({
    id: 'user-id',
    organizationId: 'organization-id',
    accessRole: 'user',
    organizationRole: 'owner',
    subscription: {
      plan: 'pro',
      status: 'expired',
      active: false,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      modules: ['budget', 'investments']
    }
  });

  await assert.rejects(
    appState.fetchAuth('/budget/transactions', { method: 'POST', body: '{}' }),
    /somente para leitura/
  );
  assert.equal(getFetchCalls(), 0);
});
