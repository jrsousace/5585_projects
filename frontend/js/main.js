// main.js - Core da aplicação

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificar se está logado
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Preencher dados do usuário
  document.getElementById('user-name').textContent = appState.user.name;

  // 3. Renderização Condicional da Navegação (Fase 3)
  renderNavigation();

  // 4. Inicializar Router
  router.init();

  // 5. Delegação de Eventos Central (Fase 2)
  setupEventDelegation();
  
  // 6. Mobile Menu Toggle
  document.getElementById('btn-menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });

  // 7. Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    appState.clear();
    window.location.href = 'login.html';
  });

  // 8. Service Worker (Fase 5)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(registration => {
        console.log('SW registrado com sucesso: ', registration.scope);
      }).catch(err => {
        console.log('Falha ao registrar SW: ', err);
      });
    });
  }
});

function renderNavigation() {
  const nav = document.getElementById('main-nav');
  
  // Links base sempre visíveis
  let navHtml = `
    <a href="#/" class="nav-item" data-link>Dashboard</a>
  `;

  // Módulos condicionais
  navHtml += `
    <a href="#/orcamento" class="nav-item" data-link>
      Orçamento Doméstico
      ${!appState.hasModuleAccess('budget') ? ' 🔒' : ''}
    </a>
  `;
  
  nav.innerHTML = navHtml;
}

function setupEventDelegation() {
  const appContainer = document.getElementById('app');
  
  appContainer.addEventListener('click', (e) => {
    // Exemplo: Botão Nova Transação
    if (e.target.matches('[data-action="nova-transacao"]')) {
      alert('Abrir modal de nova transação (A ser implementado)');
    }
    
    // Botão de Upgrade
    if (e.target.matches('.upsell-container .btn')) {
      alert('Redirecionar para página de checkout (A ser implementado)');
    }
  });
}
