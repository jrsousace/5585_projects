// store.js - Gerenciador de Estado (Fase 2)

const appState = {
  user: null,
  budget: {
    transactions: [],
    categories: [],
    accounts: []
  },
  
  // Função para inicializar o estado baseado no JWT/localStorage
  init() {
    const userData = localStorage.getItem('userData');
    if (userData) {
      this.user = JSON.parse(userData);
    }
  },

  // Checar permissões (Fase 3)
  hasModuleAccess(moduleName) {
    if (!this.user || !this.user.subscription) return false;
    // Plano PRO tem acesso a tudo, ou checamos o array de módulos
    if (this.user.subscription.plan === 'pro') return true;
    return this.user.subscription.modules.includes(moduleName);
  },

  // Logout
  clear() {
    this.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  },

  // Helper central para requisições autenticadas (Fase 3)
  async fetchAuth(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Não autenticado');

    const defaultHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const res = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erro HTTP: ${res.status}`);
    }

    return res.json();
  }
};

// Inicializa o estado ao carregar
appState.init();
