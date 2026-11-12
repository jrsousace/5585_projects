// auth.js - Gerencia a autenticação na página de login

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const registerSuccess = document.getElementById('register-success');
  const loginTitle = document.getElementById('login-title');
  const loginSubtitle = document.getElementById('login-subtitle');
  const loginEmail = document.getElementById('email');
  const loginPassword = document.getElementById('password');
  const registerEmail = document.getElementById('reg-email');
  const resendVerificationButton = document.getElementById('btn-resend-verification');
  const resendVerificationMessage = document.getElementById('resend-verification-message');

  const showLogin = () => {
    loginForm.hidden = false;
    registerForm.hidden = true;
    loginTitle.textContent = 'Bem-vindo';
    loginSubtitle.textContent = 'Faça login na sua conta';
    loginError.hidden = true;
    resendVerificationButton.hidden = true;
    resendVerificationMessage.textContent = '';
    loginEmail.focus();
  };

  const showRegister = () => {
    loginForm.hidden = true;
    registerForm.hidden = false;
    loginTitle.textContent = 'Criar conta';
    loginSubtitle.textContent = 'Preencha seus dados para começar';
    loginError.hidden = true;
    registerError.hidden = true;
    registerSuccess.hidden = true;
    document.getElementById('reg-name').focus();
  };

  document.getElementById('btn-show-register').addEventListener('click', showRegister);
  document.getElementById('btn-show-login').addEventListener('click', showLogin);

  const currentTheme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerError.hidden = true;
    registerSuccess.hidden = true;
    if (!registerForm.checkValidity()) {
      registerForm.reportValidity();
      return;
    }

    const nome = document.getElementById('reg-name').value.trim();
    const tipoCadastro = registerForm.querySelector('input[name="tipo_cadastro"]:checked').value;
    const cpf = registrationDigits(document.getElementById('reg-cpf').value);
    const telefone = `55${registrationDigits(document.getElementById('reg-phone').value)}`;
    const dataNascimento = document.getElementById('reg-birth-date').value;
    const logradouro = document.getElementById('reg-street').value.trim();
    const numero = document.getElementById('reg-number').value.trim();
    const complemento = document.getElementById('reg-complement').value.trim();
    const bairro = document.getElementById('reg-neighborhood').value.trim();
    const municipio = document.getElementById('reg-city').value.trim();
    const uf = document.getElementById('reg-state').value;
    const cep = registrationDigits(document.getElementById('reg-cep').value);
    const cnpj = document.getElementById('reg-cnpj').value.toUpperCase();
    const razaoSocial = document.getElementById('reg-legal-name').value.trim();
    const nomeFantasia = document.getElementById('reg-trade-name').value.trim();
    const email = registerEmail.value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    if (password !== passwordConfirm) {
      registerError.textContent = 'As senhas não conferem.';
      registerError.hidden = false;
      return;
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    registerForm.setAttribute('aria-busy', 'true');

    try {
      if (CONFIG.USE_MOCKS) {
        throw new Error('O cadastro não está disponível no modo de demonstração.');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          tipo_cadastro: tipoCadastro,
          cpf,
          data_nascimento: dataNascimento,
          telefone,
          email,
          logradouro,
          numero,
          complemento,
          bairro,
          municipio,
          uf,
          cep,
          cnpj,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          password
        })
      });
      const result = await readApiResponse(response, 'Não foi possível criar a conta.');

      registerForm.reset();
      loginEmail.value = email;
      registerSuccess.textContent = result.message || 'Conta criada. Agora você já pode entrar.';
      registerSuccess.hidden = false;
    } catch (error) {
      registerError.textContent = error instanceof TypeError
        ? 'Não foi possível conectar ao servidor. Tente novamente.'
        : error.message;
      registerError.hidden = false;
    } finally {
      submitButton.disabled = false;
      registerForm.removeAttribute('aria-busy');
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.hidden = true;
    resendVerificationButton.hidden = true;
    resendVerificationMessage.textContent = '';

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    loginForm.setAttribute('aria-busy', 'true');

    try {
      let response;

      if (CONFIG.USE_MOCKS) {
        response = await mockLoginApi(email, password);
      } else {
        const apiResponse = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        response = await readApiResponse(apiResponse, 'Credenciais inválidas.');
      }

      if (!response.user || !response.expiresAt) {
        throw new Error('Não foi possível autenticar. Tente novamente.');
      }

      localStorage.setItem('userData', JSON.stringify(response.user));
      localStorage.setItem('sessionExpiresAt', response.expiresAt);
      window.location.href = '/';
    } catch (error) {
      loginError.textContent = error instanceof TypeError
        ? 'Não foi possível conectar ao servidor. Tente novamente.'
        : error.message;
      loginError.hidden = false;
      if (error.code === 'EMAIL_NOT_VERIFIED') resendVerificationButton.hidden = false;
    } finally {
      submitButton.disabled = false;
      loginForm.removeAttribute('aria-busy');
    }
  });

  resendVerificationButton.addEventListener('click', async () => {
    const email = loginEmail.value.trim().toLowerCase();
    resendVerificationButton.disabled = true;
    resendVerificationMessage.textContent = '';
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await readApiResponse(response, 'Não foi possível solicitar a confirmação.');
      resendVerificationMessage.textContent = result.message;
    } catch (error) {
      resendVerificationMessage.textContent = error.message;
    } finally {
      resendVerificationButton.disabled = false;
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .catch((error) => console.error('Não foi possível registrar o service worker:', error));
    });
  }
});

async function readApiResponse(response, fallbackMessage) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    const error = new Error(result.message || fallbackMessage);
    error.code = result.code;
    throw error;
  }

  return result;
}

// Mock da API para fins de prototipagem
function mockLoginApi(email, password) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'admin@teste.com' && password === 'admin123') {
        resolve({
          token: 'mock-jwt-token-header.payload.signature',
          user: {
            id: 1,
            name: 'Administrador',
            email: 'admin@teste.com',
            subscription: {
              plan: 'pro',
              active: true,
              modules: ['budget', 'investments']
            }
          }
        });
      } else if (email === 'basico@teste.com' && password === 'basico123') {
        resolve({
          token: 'mock-jwt-token-basic.payload.signature',
          user: {
            id: 2,
            name: 'Usuário Básico',
            email: 'basico@teste.com',
            subscription: {
              plan: 'basic',
              active: true,
              modules: []
            }
          }
        });
      } else {
        reject(new Error('Credenciais inválidas.'));
      }
    }, 500);
  });
}
