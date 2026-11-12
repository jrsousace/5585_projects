const permissionModules = ['budget', 'investments'];
const permissionActions = ['read', 'write', 'export'];
const accessLevels = ['manager', 'user', 'reader'];

function isAccessLevel(value) {
  return accessLevels.includes(value);
}

function permissionsForAccessLevel(accessLevel) {
  const permissions = {};
  for (const moduleName of permissionModules) {
    permissions[moduleName] = {
      read: true,
      write: accessLevel !== 'reader',
      export: accessLevel === 'manager'
    };
  }
  return permissions;
}

function hasCurrentSubscription(user) {
  return user.plan === 'pro' &&
    user.subscriptionStatus === 'active' &&
    user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

function normalizePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const normalized = {};
  for (const [moduleName, actions] of Object.entries(value)) {
    if (!permissionModules.includes(moduleName) || !actions || typeof actions !== 'object' || Array.isArray(actions)) {
      return null;
    }

    if (Object.keys(actions).some((action) => !permissionActions.includes(action))) {
      return null;
    }

    normalized[moduleName] = {};
    for (const action of permissionActions) {
      if (actions[action] !== undefined && typeof actions[action] !== 'boolean') {
        return null;
      }
      normalized[moduleName][action] = actions[action] === true;
    }
  }

  return normalized;
}

function requirePermission(moduleName, action) {
  return (req, res, next) => {
    const user = req.user;
    const subscriptionCurrent = hasCurrentSubscription(user);
    const allowedReadOnly = user.plan === 'pro' &&
      req.method === 'GET' &&
      action === 'read';

    if (!subscriptionCurrent && !allowedReadOnly) {
      return res.status(403).json({
        message: 'O acesso à nuvem exige uma assinatura vigente. Contas gratuitas usam armazenamento local.'
      });
    }

    const roleAllows = user.organizationRole === 'owner' ||
      user.accessLevel === 'manager' ||
      (user.accessLevel === 'reader' && action === 'read') ||
      (user.accessLevel === 'user' && action !== 'export');
    if (roleAllows && (user.organizationRole !== 'member' ||
        user.accessLevel === 'manager' ||
        user.permissions?.[moduleName]?.[action] === true)) {
      return next();
    }

    return res.status(403).json({ message: 'Você não tem permissão para esta ação.' });
  };
}

function requireOrganizationOwner(req, res, next) {
  if (req.user.organizationRole !== 'owner') {
    return res.status(403).json({ message: 'Apenas o titular da organização pode gerenciar os membros.' });
  }
  return next();
}

function requireOrganizationManager(req, res, next) {
  const owner = req.user.organizationRole === 'owner';
  const paidManager = req.user.accessLevel === 'manager' && hasCurrentSubscription(req.user);
  if (!owner && !paidManager) {
    return res.status(403).json({ message: 'Apenas o titular ou um gestor de assinatura vigente pode administrar usuários.' });
  }
  return next();
}

function requireMaster(req, res, next) {
  if (req.user.accessRole !== 'master') {
    return res.status(403).json({ message: 'Apenas a conta master pode gerenciar assinaturas.' });
  }
  return next();
}

module.exports = {
  normalizePermissions,
  isAccessLevel,
  permissionsForAccessLevel,
  hasCurrentSubscription,
  requirePermission,
  requireOrganizationOwner,
  requireOrganizationManager,
  requireMaster
};
