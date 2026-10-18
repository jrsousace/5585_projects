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

  // Modal Fechar Global
  const modalBackdrop = document.getElementById('modal-backdrop');
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    modalBackdrop.style.display = 'none';
  });
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.style.display = 'none';
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
      abrirModalNovaTransacao();
    }
    
    // Botão de Upgrade
    if (e.target.matches('.upsell-container .btn')) {
      alert('Redirecionar para página de checkout (A ser implementado)');
    }
  });
}

function abrirModalNovaTransacao() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-transacao');
  
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  // Atrela o submit ao formulário recém injetado
  const form = document.getElementById('form-transacao');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const transacao = {
      tipo: document.getElementById('t-tipo').value,
      descricao: document.getElementById('t-descricao').value,
      valor_total: parseFloat(document.getElementById('t-valor').value),
      data_evento: document.getElementById('t-data').value,
      competencia: document.getElementById('t-data').value.substring(0, 7) // 'YYYY-MM'
    };

    if (CONFIG.USE_MOCKS) {
      alert('Modo Mock: Transação não salva.');
      modalBackdrop.style.display = 'none';
      return;
    }

    try {
      await appState.fetchAuth('/budget/transactions', {
        method: 'POST',
        body: JSON.stringify(transacao)
      });
      modalBackdrop.style.display = 'none';
      
      // Forçar recarregamento do módulo Orçamento
      const event = new CustomEvent('routeChanged', { detail: { path: '/orcamento', route: { module: 'budget' } } });
      document.dispatchEvent(event);
      
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Salvar Transação';
    }
  });

  modalBackdrop.style.display = 'flex';
}
