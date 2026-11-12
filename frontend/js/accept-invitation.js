const invitationToken = new URLSearchParams(window.location.search).get('token') || '';
window.history.replaceState(null, '', window.location.pathname);

const invitationForm = document.getElementById('invitation-form');
const invitationMessage = document.getElementById('invite-message');

if (!invitationToken) {
  invitationForm.hidden = true;
  invitationMessage.textContent = 'Este link de convite é inválido ou está incompleto.';
}

invitationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!invitationForm.checkValidity()) {
    invitationForm.reportValidity();
    return;
  }
  const password = document.getElementById('invite-password').value;
  const passwordConfirm = document.getElementById('invite-password-confirm').value;
  const personalData = {
    nome: document.getElementById('invite-name').value.trim(),
    cpf: registrationDigits(document.getElementById('invite-cpf').value),
    data_nascimento: document.getElementById('invite-birth-date').value,
    telefone: `55${registrationDigits(document.getElementById('invite-phone').value)}`,
    email: document.getElementById('invite-email').value.trim().toLowerCase(),
    logradouro: document.getElementById('invite-street').value.trim(),
    numero: document.getElementById('invite-number').value.trim(),
    complemento: document.getElementById('invite-complement').value.trim(),
    bairro: document.getElementById('invite-neighborhood').value.trim(),
    municipio: document.getElementById('invite-city').value.trim(),
    uf: document.getElementById('invite-state').value,
    cep: registrationDigits(document.getElementById('invite-cep').value)
  };
  if (password !== passwordConfirm) {
    invitationMessage.textContent = 'As senhas não coincidem.';
    return;
  }

  invitationMessage.textContent = 'Validando convite...';
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/invitations/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invitationToken, password, ...personalData })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || `Erro HTTP: ${response.status}`);
    }
    invitationMessage.textContent = `${result.message} Redirecionando para o login...`;
    invitationForm.querySelector('button[type="submit"]').disabled = true;
    window.setTimeout(() => {
      window.location.assign('/login');
    }, 1800);
  } catch (error) {
    invitationMessage.textContent = error.message;
  }
});
