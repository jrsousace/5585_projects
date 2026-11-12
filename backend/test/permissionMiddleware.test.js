const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePermissions,
  requirePermission,
  requireOrganizationOwner,
  requireMaster
} = require('../src/middlewares/permissionMiddleware');

function runMiddleware(middleware, user, method = 'GET') {
  const result = { status: null, body: null, nextCalled: false };
  const response = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  middleware({ user, method }, response, () => {
    result.nextCalled = true;
  });
  return result;
}

test('permission normalization accepts known modules and boolean actions only', () => {
  assert.deepEqual(normalizePermissions({
    budget: { read: true, write: false, export: true },
    investments: { read: true }
  }), {
    budget: { read: true, write: false, export: true },
    investments: { read: true, write: false, export: false }
  });
  assert.equal(normalizePermissions({ admin: { read: true } }), null);
  assert.equal(normalizePermissions({ budget: { write: 'yes' } }), null);
  assert.equal(normalizePermissions({ investments: { delete: true } }), null);
});

test('module permissions require both subscription entitlement and the configured action', () => {
  const deniedByPlan = runMiddleware(requirePermission('budget', 'read'), {
    accessRole: 'user',
    organizationRole: 'owner',
    plan: 'basic',
    permissions: {}
  });
  assert.equal(deniedByPlan.status, 403);
  assert.equal(deniedByPlan.nextCalled, false);

  const deniedByPermission = runMiddleware(requirePermission('budget', 'write'), {
    accessRole: 'user',
    organizationRole: 'member',
    accessLevel: 'user',
    plan: 'pro',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 60_000),
    permissions: { budget: { read: true, write: false } }
  }, 'POST');
  assert.equal(deniedByPermission.status, 403);

  const allowedMember = runMiddleware(requirePermission('budget', 'read'), {
    accessRole: 'user',
    organizationRole: 'member',
    accessLevel: 'user',
    plan: 'pro',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 60_000),
    permissions: { budget: { read: true } }
  });
  assert.equal(allowedMember.nextCalled, true);

  const allowedExpiredRead = runMiddleware(requirePermission('budget', 'read'), {
    accessRole: 'user',
    organizationRole: 'owner',
    plan: 'pro',
    subscriptionStatus: 'expired',
    subscriptionExpiresAt: new Date(Date.now() - 60_000),
    permissions: {}
  });
  assert.equal(allowedExpiredRead.nextCalled, true);

  const deniedExpiredWrite = runMiddleware(requirePermission('budget', 'write'), {
    accessRole: 'user',
    organizationRole: 'owner',
    plan: 'pro',
    subscriptionStatus: 'expired',
    subscriptionExpiresAt: new Date(Date.now() - 60_000),
    permissions: {}
  }, 'POST');
  assert.equal(deniedExpiredWrite.status, 403);

  const deniedBasicCloudRead = runMiddleware(requirePermission('budget', 'read'), {
    accessRole: 'user',
    organizationRole: 'owner',
    plan: 'basic',
    subscriptionStatus: 'free',
    permissions: {}
  });
  assert.equal(deniedBasicCloudRead.status, 403);

  const allowedMaster = runMiddleware(requirePermission('investments', 'write'), {
    accessRole: 'master',
    organizationRole: 'member',
    plan: 'basic',
    accessLevel: 'user',
    permissions: { investments: { read: true, write: true } }
  });
  assert.equal(allowedMaster.status, 403);

  const allowedPaidMaster = runMiddleware(requirePermission('investments', 'write'), {
    accessRole: 'master',
    organizationRole: 'member',
    accessLevel: 'user',
    plan: 'pro',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 60_000),
    permissions: { investments: { read: true, write: true } }
  }, 'POST');
  assert.equal(allowedPaidMaster.nextCalled, true);
});

test('only organization owners can administer members', () => {
  assert.equal(runMiddleware(requireOrganizationOwner, {
    organizationRole: 'owner'
  }).nextCalled, true);
  assert.equal(runMiddleware(requireOrganizationOwner, {
    accessRole: 'master',
    organizationRole: 'member'
  }).status, 403);
});

test('only master accounts can manage subscription entitlements', () => {
  assert.equal(runMiddleware(requireMaster, { accessRole: 'master' }).nextCalled, true);
  assert.equal(runMiddleware(requireMaster, { accessRole: 'user' }).status, 403);
});
