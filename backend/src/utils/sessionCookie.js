const cookieName = '5585_session';
const sessionDurationMs = 8 * 60 * 60 * 1000;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/api',
    maxAge: sessionDurationMs
  };
}

function readSessionCookie(req) {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== 'string') return null;
  const entry = cookieHeader.split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(cookieName.length + 1));
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.cookie(cookieName, token, sessionCookieOptions());
}

function clearSessionCookie(res) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(cookieName, options);
}

module.exports = {
  sessionCookieOptions,
  readSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  sessionDurationMs
};
