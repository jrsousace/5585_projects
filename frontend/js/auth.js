// auth.js - Gerencia a autenticação na página de login

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const errorMsg = document.getElementById('login-error');
  
  const btnShowRegister = document.getElementById('btn-show-register');
  const btnShowLogin = document.getElementById('btn-show-login');

  // Alternar entre Login e Registro
  if (btnShowRegister && btnShowLogin) {
    btnShowRegister.addEventListener('click', () => {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
    });
    btnShowLogin.addEventListener('click', () => {
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
    });
  }

  // --- LÓGICA DE REGISTRO ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nome = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      
      const regError = document.getElementById('register-error');
      const regSuccess = document.getElementById('register-success');
      regError.style.display = 'none';
      regSuccess.style.display = 'none';
      
      try {
        if (CONFIG.USE_MOCKS) {
          throw new Error('Registro não disponível no modo Mock. Use admin@teste.com para entrar.');
        }

        const res = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, email, password })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Erro ao registrar');
        }
        
        regSuccess.style.display = 'block';
        setTimeout(() => btnShowLogin.click(), 2000); // Volta pro login após sucesso
        
      } catch (error) {
        regError.style.display = 'block';
        regError.textContent = error.message;
      }
    });
  }

  // --- LÓGICA DE LOGIN ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        let response;
        
        if (CONFIG.USE_MOCKS) {
          // Simulação de chamada ao backend (Mocks)
          response = await mockLoginApi(email, password);
        } else {
          // Chamada real ao Backend (Node.js)
          const res = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Credenciais inválidas');
          }
          
          response = await res.json();
        }
        
        if (response.token) {
          // Fase 1: Armazenamento de Sessão - localStorage
          localStorage.setItem('authToken', response.token);
          localStorage.setItem('userData', JSON.stringify(response.user));
          
          // Redirecionamento
          window.location.href = 'index.html';
        }
      } catch (error) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = error.message;
      }
    });
  }

  // Service Worker (Fase 5)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js');
    });
  }
});

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
            // Nível de assinatura simulado
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
              modules: [] // Sem acesso aos módulos premium
            }
          }
        });
      } else {
        reject(new Error('Credenciais inválidas. Use admin@teste.com / admin123'));
      }
    }, 500);
  });
}
