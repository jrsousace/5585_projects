const securityMessage = document.getElementById('security-message');
const requestResetForm = document.getElementById('request-reset-form');
const resendVerificationForm = document.getElementById('resend-verification-form');
const setNewPasswordForm = document.getElementById('set-new-password-form');
const query = new URLSearchParams(window.location.search);
const verificationToken = query.get('verify');
const resetToken = query.get('reset');
window.history.replaceState({}, '', window.location.pathname);

async function postSecurityRequest(path, body) {
  const response = await fetch(`${CONFIG.API_BASE_URL}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Erro HTTP ${response.status}`);
  return result;
}

requestResetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  securityMessage.textContent = '';
  try {
    const result = await postSecurityRequest('password/forgot', {
      email: document.getElementById('reset-email').value.trim().toLowerCase()
    });
    securityMessage.textContent = result.message;
  } catch (error) {
    securityMessage.textContent = error.message;
  }
});

resendVerificationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  securityMessage.textContent = '';
  try {
    const result = await postSecurityRequest('resend-verification', {
      email: document.getElementById('verify-email-address').value.trim().toLowerCase()
    });
    securityMessage.textContent = result.message;
  } catch (error) {
    securityMessage.textContent = error.message;
  }
});

if (resetToken) {
  requestResetForm.hidden = true;
  resendVerificationForm.hidden = true;
  setNewPasswordForm.hidden = false;
} else if (verificationToken) {
  requestResetForm.hidden = true;
  resendVerificationForm.hidden = true;
  postSecurityRequest('verify-email', { token: verificationToken })
    .then((result) => { securityMessage.textContent = result.message; })
    .catch((error) => { securityMessage.textContent = error.message; });
}

setNewPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.getElementById('new-password').value;
  const confirmation = document.getElementById('confirm-new-password').value;
  if (password !== confirmation) {
    securityMessage.textContent = 'As senhas não coincidem.';
    return;
  }
  const submit = setNewPasswordForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const result = await postSecurityRequest('password/reset', { token: resetToken, password });
    setNewPasswordForm.hidden = true;
    securityMessage.textContent = result.message;
  } catch (error) {
    securityMessage.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
