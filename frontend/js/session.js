function getActiveSession() {
  try {
    const user = JSON.parse(localStorage.getItem('userData') || 'null');
    const expiresAt = Date.parse(localStorage.getItem('sessionExpiresAt') || '');

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() ||
        !user || typeof user !== 'object') {
      clearStoredSession();
      return null;
    }

    return { expiresAt, user };
  } catch {
    clearStoredSession();
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem('sessionExpiresAt');
  localStorage.removeItem('userData');
}
