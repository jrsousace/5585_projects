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
    const session = getActiveSession();
    this.user = session ? session.user : null;
  },

  dataMode() {
    if (this.user?.subscription?.plan !== 'pro') return 'local';
    const expiresAt = this.user.subscription.expiresAt;
    return this.user.subscription.active === true &&
      expiresAt &&
      Date.parse(expiresAt) > Date.now()
      ? 'cloud'
      : 'readonly';
  },

  canWriteData(moduleName) {
    if (this.dataMode() === 'readonly') return false;
    if (this.user?.organizationRole === 'owner' || this.user?.accessLevel === 'manager') return true;
    if (this.user?.accessLevel === 'reader') return false;
    return this.user.permissions?.[moduleName]?.write === true;
  },

  async refreshSession() {
    if (!localStorage.getItem('sessionExpiresAt')) return false;

    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/session`, {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (response.status === 401 || response.status === 403) {
      this.clear();
      return false;
    }
    if (!response.ok) {
      throw new Error(`Não foi possível atualizar a sessão (HTTP ${response.status}).`);
    }

    const user = await response.json();
    localStorage.setItem('userData', JSON.stringify(user));
    this.user = user;
    return true;
  },

  hasModuleAccess(moduleName) {
    if (!this.user) return false;
    const permissionModule = moduleName === 'premium' ? 'budget' : moduleName;
    return this.user.organizationRole === 'owner' ||
      this.user.accessLevel === 'manager' ||
      this.user.permissions?.[permissionModule]?.read === true;
  },

  localStorageKey(moduleName) {
    const organizationId = this.user?.organizationId || this.user?.id;
    if (!organizationId) throw new Error('Não foi possível identificar a conta para o armazenamento local.');
    return `5585:local:${organizationId}:${moduleName}`;
  },

  readLocalData(moduleName) {
    const key = this.localStorageKey(moduleName);
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return moduleName === 'investments'
        ? { investments: [] }
        : {
            transactions: [],
            groups: [],
            categories: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer']
              .map((nome_categoria, index) => ({ id_categoria: `local-category-${index + 1}`, nome_categoria })),
            accounts: [],
            paymentMethods: ['PIX', 'Dinheiro', 'Crédito', 'Débito']
              .map((nome, index) => ({ id_forma_pg: `local-payment-${index + 1}`, nome }))
          };
    }

    try {
      const data = JSON.parse(stored);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid local dataset');
      }
      if (moduleName === 'investments') {
        if (!Array.isArray(data.investments)) throw new Error('Invalid investments dataset');
      } else {
        for (const collection of ['transactions', 'groups', 'categories', 'accounts', 'paymentMethods']) {
          if (data[collection] === undefined) data[collection] = [];
          if (!Array.isArray(data[collection])) throw new Error('Invalid finance dataset');
        }
      }
      return data;
    } catch {
      throw new Error('Os dados locais desta conta estão corrompidos e não foram alterados.');
    }
  },

  writeLocalData(moduleName, data) {
    try {
      localStorage.setItem(this.localStorageKey(moduleName), JSON.stringify(data));
    } catch (error) {
      if (error?.name === 'QuotaExceededError') {
        throw new Error('O armazenamento local do navegador está cheio. Libere espaço antes de salvar.');
      }
      throw error;
    }
  },

  async localDataRequest(endpoint, options) {
    const method = (options.method || 'GET').toUpperCase();
    const financeEndpoints = new Set([
      '/budget/transactions',
      '/budget/faturas',
      '/budget/assinaturas',
      '/auxiliary/categorias',
      '/auxiliary/grupos',
      '/auxiliary/contas',
      '/auxiliary/formas-pagamento',
      '/auxiliary/bancos'
    ]);
    const investmentEndpoint = endpoint === '/investments';
    if (!financeEndpoints.has(endpoint) && !investmentEndpoint) return undefined;

    const moduleName = investmentEndpoint ? 'investments' : 'budget';
    if (!this.hasModuleAccess(moduleName)) throw new Error('Você não tem permissão para acessar este módulo.');
    if (method !== 'GET' && !this.canWriteData(moduleName)) {
      throw new Error(this.dataMode() === 'readonly'
        ? 'A assinatura venceu. Os dados na nuvem estão disponíveis somente para leitura.'
        : 'Você não tem permissão para alterar os dados deste módulo.');
    }

    const data = this.readLocalData(investmentEndpoint ? 'investments' : 'finance');
    if (method === 'GET') {
      const collections = {
        '/budget/transactions': data.transactions,
        '/budget/faturas': [],
        '/budget/assinaturas': [],
        '/auxiliary/categorias': data.categories,
        '/auxiliary/grupos': data.groups,
        '/auxiliary/contas': data.accounts,
        '/auxiliary/formas-pagamento': data.paymentMethods,
        '/auxiliary/bancos': [
          { compe: '001', ispb: '00000000', nome_curto: 'BCO DO BRASIL S.A.', nome_completo: 'Banco do Brasil S.A.' },
          { compe: '033', ispb: '90400888', nome_curto: 'BCO SANTANDER (BRASIL) S.A.', nome_completo: 'Banco Santander (Brasil) S.A.' },
          { compe: '104', ispb: '00360305', nome_curto: 'CAIXA ECONOMICA FEDERAL', nome_completo: 'Caixa Econômica Federal' },
          { compe: '237', ispb: '60746948', nome_curto: 'BCO BRADESCO S.A.', nome_completo: 'Banco Bradesco S.A.' },
          { compe: '260', ispb: '18236120', nome_curto: 'NU PAGAMENTOS S.A.', nome_completo: 'Nu Pagamentos S.A. - Instituição de Pagamento' },
          { compe: '341', ispb: '60701190', nome_curto: 'ITAÚ UNIBANCO S.A.', nome_completo: 'Itaú Unibanco S.A.' }
        ],
        '/investments': data.investments
      };
      return collections[endpoint];
    }

    let payload;
    try {
      payload = options.body ? JSON.parse(options.body) : {};
    } catch {
      throw new Error('Não foi possível interpretar os dados enviados para salvar.');
    }

    const id = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (endpoint === '/budget/transactions') {
      const transaction = { ...payload, id_transacao: id };
      data.transactions.push(transaction);
      this.writeLocalData('finance', data);
      return transaction;
    }
    if (endpoint === '/auxiliary/categorias') {
      const category = { ...payload, id_categoria: id };
      data.categories.push(category);
      this.writeLocalData('finance', data);
      return category;
    }
    if (endpoint === '/auxiliary/grupos') {
      const group = { ...payload, id_grupo: id };
      data.groups.push(group);
      this.writeLocalData('finance', data);
      return group;
    }
    if (endpoint === '/auxiliary/contas') {
      const account = { ...payload, id_conta: id };
      data.accounts.push(account);
      this.writeLocalData('finance', data);
      return account;
    }
    if (endpoint === '/investments') {
      const investment = { ...payload, id_investimento: id };
      data.investments.push(investment);
      this.writeLocalData('investments', data);
      return investment;
    }
    throw new Error('Esta operação ainda não está disponível no armazenamento local.');
  },

  // Logout
  clear() {
    this.user = null;
    fetch(`${CONFIG.API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true
    }).catch((error) => console.error('Nao foi possivel encerrar o cookie da sessao:', error));
    localStorage.removeItem('sessionExpiresAt');
    localStorage.removeItem('userData');
  },

  // Helper central para requisições autenticadas (Fase 3)
  async fetchAuth(endpoint, options = {}) {
    if (!localStorage.getItem('sessionExpiresAt')) throw new Error('Nao autenticado');

    const method = (options.method || 'GET').toUpperCase();
    const isDataEndpoint = endpoint.startsWith('/budget/') ||
      endpoint.startsWith('/auxiliary/') ||
      endpoint === '/investments';
    if (isDataEndpoint && this.dataMode() === 'local') {
      const localResult = await this.localDataRequest(endpoint, options);
      if (localResult !== undefined) return localResult;
    }
    if (isDataEndpoint && this.dataMode() === 'readonly' && method !== 'GET') {
      throw new Error('A assinatura venceu. Os dados na nuvem estão disponíveis somente para leitura.');
    }

    const defaultHeaders = { 'Content-Type': 'application/json' };

    const res = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erro HTTP: ${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
  },

  // MÉTODOS DE DADOS - CADASTROS
  async fetchCategorias() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id_categoria: 'uuid-m1', nome_categoria: 'Moradia' },
        { id_categoria: 'uuid-m2', nome_categoria: 'Alimentação' },
        { id_categoria: 'uuid-m3', nome_categoria: 'Lazer' }
      ];
    }
    const categorias = await this.fetchAuth('/auxiliary/categorias');
    this.budget.categories = categorias;
    return categorias;
  },

  async salvarCategoria(payload) {
    if (CONFIG.USE_MOCKS) {
      return { id_categoria: 'uuid-m4', ...payload };
    }
    const novaCat = await this.fetchAuth('/auxiliary/categorias', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    this.budget.categories.push(novaCat);
    return novaCat;
  },

  async fetchBancos() {
    if (CONFIG.USE_MOCKS) {
      // Lista local estática (Mocks com os novos campos da BrasilAPI)
      return [
        { compe: '001', ispb: '00000000', nome_curto: 'BCO DO BRASIL S.A.', nome_completo: 'Banco do Brasil S.A.' },
        { compe: '033', ispb: '90400888', nome_curto: 'BCO SANTANDER (BRASIL) S.A.', nome_completo: 'Banco Santander (Brasil) S.A.' },
        { compe: '104', ispb: '00360305', nome_curto: 'CAIXA ECONOMICA FEDERAL', nome_completo: 'Caixa Econômica Federal' },
        { compe: '237', ispb: '60746948', nome_curto: 'BCO BRADESCO S.A.', nome_completo: 'Banco Bradesco S.A.' },
        { compe: '260', ispb: '18236120', nome_curto: 'NU PAGAMENTOS S.A.', nome_completo: 'Nu Pagamentos S.A. - Instituição de Pagamento' },
        { compe: '341', ispb: '60701190', nome_curto: 'ITAÚ UNIBANCO S.A.', nome_completo: 'Itaú Unibanco S.A.' }
      ];
    }
    return this.fetchAuth('/auxiliary/bancos');
  },

  async fetchGrupos() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id_grupo: 'g1', grupo: 'Despesas Fixas' },
        { id_grupo: 'g2', grupo: 'Despesas Variáveis' }
      ];
    }
    if (this.dataMode() === 'local') return this.localDataRequest('/auxiliary/grupos', {});
    return [];
  },

  async fetchContas() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id_conta: 'c1', conta: 'Conta Corrente Nu', banco: 'Nubank', num_conta: '12345-6' }
      ];
    }
    return this.fetchAuth('/auxiliary/contas');
  },

  async fetchCentrosCusto() {
    if (CONFIG.USE_MOCKS) return [{ id: 'cc1', nome: 'Pessoal' }, { id: 'cc2', nome: 'Empresa' }];
    return []; 
  },

  async fetchFormasPgto() {
    if (CONFIG.USE_MOCKS) return [{ id: 'f1', nome: 'Cartão de Crédito' }, { id: 'f2', nome: 'PIX' }];
    const formas = await this.fetchAuth('/auxiliary/formas-pagamento');
    return formas.map(f => ({ id: f.id_forma_pg, nome: f.nome || f.forma_pagamento }));
  },

  async fetchTiposInvestimento() {
    if (CONFIG.USE_MOCKS) return [
      { id: 't1', nome: 'Renda Fixa' }, 
      { id: 't2', nome: 'Renda Variável (Ações)' },
      { id: 't3', nome: 'Fundos Imobiliários (FIIs)' },
      { id: 't4', nome: 'Previdência Privada' }
    ];
    return []; 
  },

  // --- MÓDULO DE FATURAS E IMPORTAÇÃO ---
  async fetchFaturas() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id: 'fat1', vencimento: '2023-11-10', referencia: 'Cartão Nubank (Final 4832)', valor: 1420.00, status: 'Aberta' },
        { id: 'fat2', vencimento: '2023-11-05', referencia: 'Conta de Luz (Enel)', valor: 96.00, status: 'Paga' },
        { id: 'fat3', vencimento: '2023-11-15', referencia: 'Cartão Itaú (Final 1122)', valor: 350.60, status: 'Fechada' }
      ];
    }
    return this.fetchAuth('/budget/faturas'); // Placeholder para backend real
  },

  // --- MÓDULO DE ASSINATURAS ---
  async fetchAssinaturas() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id: 'as1', servico: 'Netflix Premium', categoria: 'Lazer', proxima_cobranca: '2023-11-12', valor: 55.90, status: 'Ativo' },
        { id: 'as2', servico: 'Spotify Family', categoria: 'Lazer', proxima_cobranca: '2023-11-08', valor: 34.90, status: 'Ativo' },
        { id: 'as3', servico: 'Amazon AWS', categoria: 'Empresa', proxima_cobranca: '2023-11-15', valor: 120.00, status: 'Ativo' },
        { id: 'as4', servico: 'Academia SmartFit', categoria: 'Saúde', proxima_cobranca: '2023-11-20', valor: 119.90, status: 'Pausado' }
      ];
    }
    return this.fetchAuth('/budget/assinaturas'); // Placeholder
  },

  // --- MÓDULO DE INVESTIMENTOS ---
  async fetchInvestimentos() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id: 'inv1', ativo: 'Tesouro Selic 2029', nome_tipo_investimento: 'Renda Fixa', data_aplicacao: '2023-01-10', valor_investido: 10000.00, indexador: 'Selic', taxa_contratada: 100, vencimento: '2029-03-01' },
        { id: 'inv2', ativo: 'PETR4', nome_tipo_investimento: 'Renda Variável (Ações)', data_aplicacao: '2023-05-15', valor_investido: 5200.00, indexador: 'Ações/FIIs', taxa_contratada: null, vencimento: null },
        { id: 'inv3', ativo: 'CDB Banco Inter', nome_tipo_investimento: 'Renda Fixa', data_aplicacao: '2023-08-20', valor_investido: 15000.00, indexador: 'CDI', taxa_contratada: 110, vencimento: '2025-08-20' },
        { id: 'inv4', ativo: 'HGLG11', nome_tipo_investimento: 'Fundos Imobiliários (FIIs)', data_aplicacao: '2023-09-05', valor_investido: 8500.00, indexador: 'Ações/FIIs', taxa_contratada: null, vencimento: null }
      ];
    }
    return this.fetchAuth('/investments'); // Rota do backend já pronta
  },

  // --- MÓDULO DE METAS E ORÇAMENTO ---
  async fetchMetas() {
    if (CONFIG.USE_MOCKS) {
      return [
        { id: 'm1', nome: 'Reserva de Emergência', alvo: 15000.00, atual: 11200.00, vinculo: 'inv3' },
        { id: 'm2', nome: 'Viagem Japão', alvo: 25000.00, atual: 4500.00, vinculo: 'inv1' },
        { id: 'm3', nome: 'Troca de Carro', alvo: 40000.00, atual: 40000.00, vinculo: 'none' }
      ];
    }
    return [];
  },

  async fetchOrcamentoMensal() {
    if (CONFIG.USE_MOCKS) {
      return { teto: 6000.00, gasto: 4850.50 };
    }
    return { teto: 0, gasto: 0 };
  },

  async salvarEntidadeSimples(endpoint, payload) {
    if (CONFIG.USE_MOCKS) return payload;
    // const res = await this.fetchAuth(endpoint, { method: 'POST', body: JSON.stringify(payload) }); return res;
    return payload; // Fallback mock
  }

};

// Inicializa o estado ao carregar
appState.init();
