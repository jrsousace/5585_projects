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

  // Theme Toggle
  setupThemeToggle();

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
  
  const lock = (module) => !appState.hasModuleAccess(module) ? '<span class="lock-icon">🔒</span>' : '';

  const navHtml = `
    <a href="#/" class="nav-item" data-link>📊 Dashboard</a>
    <a href="#/transacoes" class="nav-item" data-link>💸 Transações ${lock('budget')}</a>
    <a href="#/faturas" class="nav-item" data-link>💳 Faturas (Cartões) ${lock('premium')}</a>
    <a href="#/assinaturas" class="nav-item" data-link>🔁 Assinaturas ${lock('premium')}</a>
    <a href="#/investimentos" class="nav-item" data-link>📈 Investimentos ${lock('investments')}</a>
    <a href="#/metas" class="nav-item" data-link>🎯 Orçamentos / Metas ${lock('premium')}</a>
    
    <div class="nav-accordion">
      <button class="nav-accordion-btn">📂 Cadastros <span class="arrow">▼</span></button>
      <div class="nav-submenu">
        <a href="#/cadastros/contas" class="nav-item nav-sub-item" data-link>Contas e Cartões</a>
        <a href="#/cadastros/categorias" class="nav-item nav-sub-item" data-link>Grupos e Categorias</a>
        <a href="#/cadastros/centros-custo" class="nav-item nav-sub-item" data-link>Centros de Custo</a>
        <a href="#/cadastros/formas-pgto" class="nav-item nav-sub-item" data-link>Formas de Pagamento</a>
        <a href="#/cadastros/tipos-invest" class="nav-item nav-sub-item" data-link>Tipos de Investimento</a>
      </div>
    </div>

    <div class="nav-accordion">
      <button class="nav-accordion-btn">📑 Relatórios ${lock('premium')} <span class="arrow">▼</span></button>
      <div class="nav-submenu">
        <a href="#/relatorios/fluxo" class="nav-item nav-sub-item" data-link>Fluxo de Caixa</a>
        <a href="#/relatorios/despesas" class="nav-item nav-sub-item" data-link>Análise de Despesas</a>
        <a href="#/relatorios/patrimonio" class="nav-item nav-sub-item" data-link>Evolução Patrimonial</a>
        <a href="#/relatorios/performance" class="nav-item nav-sub-item" data-link>Performance de Investimentos</a>
      </div>
    </div>

    <br><hr style="border:0; border-top: 1px solid rgba(255,255,255,0.05); margin: 1rem 0;">

    <div class="nav-accordion">
      <button class="nav-accordion-btn">🧮 Ferramentas <span class="arrow">▼</span></button>
      <div class="nav-submenu">
        <a href="#/tools/juros" class="nav-item nav-sub-item" data-link>Simuladores (Juros)</a>
        <a href="#/tools/independencia" class="nav-item nav-sub-item" data-link>Independência Financeira</a>
        <a href="#/tools/amortizacao" class="nav-item nav-sub-item" data-link>Calc. de Amortização</a>
      </div>
    </div>

    <div class="nav-accordion">
      <button class="nav-accordion-btn">🏛️ Imposto de Renda ${lock('premium')} <span class="arrow">▼</span></button>
      <div class="nav-submenu">
        <a href="#/irpf/resumo" class="nav-item nav-sub-item" data-link>Resumo para Declaração</a>
        <a href="#/irpf/apuracao" class="nav-item nav-sub-item" data-link>Apuração de Ações</a>
      </div>
    </div>
  `;
  
  nav.innerHTML = navHtml;
  setupAccordions();
}

function setupAccordions() {
  // Accordions do menu principal e do footer
  const accordions = document.querySelectorAll('.nav-accordion-btn');
  accordions.forEach(acc => {
    // Evitar multi-bind
    const newBtn = acc.cloneNode(true);
    acc.parentNode.replaceChild(newBtn, acc);
    
    newBtn.addEventListener('click', function() {
      this.classList.toggle('active');
      const submenu = this.nextElementSibling;
      if (submenu.style.maxHeight) {
        submenu.style.maxHeight = null;
      } else {
        submenu.style.maxHeight = submenu.scrollHeight + "px";
      }
    });
  });
}

function setupEventDelegation() {
  const appContainer = document.getElementById('app');
  
  appContainer.addEventListener('click', (e) => {
    // Exemplo: Botão Nova Transação
    if (e.target.matches('[data-action="nova-transacao"]')) {
      abrirModalNovaTransacao();
    }
    // Botão Importar Fatura (OCR) e Open Finance
    if (e.target.matches('[data-action="importar-fatura"]')) {
      abrirModalImportarFatura();
    }
    if (e.target.matches('[data-action="conectar-open-finance"]')) {
      abrirModalOpenFinance();
    }
    
    // Botão Nova Assinatura
    if (e.target.matches('[data-action="nova-assinatura"]')) {
      abrirModalAssinatura();
    }
    // Botão Editar Assinatura
    if (e.target.matches('[data-action="editar-assinatura"]')) {
      abrirModalAssinatura(e.target.getAttribute('data-id'));
    }

    // Botão Novo Investimento
    if (e.target.matches('[data-action="novo-investimento"]')) {
      abrirModalInvestimento();
    }
    // Botão Editar Investimento
    if (e.target.matches('[data-action="editar-investimento"]')) {
      abrirModalInvestimento(e.target.getAttribute('data-id'));
    }

    // Botão Nova Meta
    if (e.target.matches('[data-action="nova-meta"]')) {
      abrirModalNovaMeta();
    }

    // Botão Nova Categoria (Módulo Cadastros)
    if (e.target.matches('[data-action="nova-categoria"]')) {
      abrirModalNovaCategoria();
    }
    
    // Botão Nova Conta (Módulo Cadastros)
    if (e.target.matches('[data-action="nova-conta"]')) {
      abrirModalNovaConta();
    }

    // Botões Novos (Entidades Simples + Grupos)
    if (e.target.matches('[data-action="novo-grupo"]')) {
      abrirModalNovoGrupo();
    }
    if (e.target.matches('[data-action="novo-simples"]')) {
      abrirModalSimples('Novo(a) ' + e.target.getAttribute('data-tipo'), e.target.getAttribute('data-tipo'));
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
      transacao_status: document.getElementById('t-status').value,
      descricao: document.getElementById('t-descricao').value,
      valor_total: parseFloat(document.getElementById('t-valor').value),
      data_vencimento: document.getElementById('t-data-venc').value,
      data_pagamento: document.getElementById('t-data-pag').value || null,
      competencia: document.getElementById('t-data-venc').value.substring(0, 7), // 'YYYY-MM'
      parcela_atual: 1,
      total_parcelas: 1,
      observacao: document.getElementById('t-obs').value
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
      const event = new CustomEvent('routeChanged', { detail: { path: '/transacoes', route: { module: 'budget' } } });
      document.dispatchEvent(event);
      
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Salvar Transação';
    }
  });

  modalBackdrop.style.display = 'flex';
}
async function abrirModalImportarFatura() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-import');
  
  document.getElementById('modal-title').textContent = 'Importar Fatura (OCR)';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  const form = document.getElementById('form-import');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('f-arquivo');
  const uploadText = document.getElementById('upload-text');
  
  // Gatilho visual do input de arquivo
  uploadZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadText.innerHTML = `<strong>Arquivo:</strong> ${fileInput.files[0].name}`;
      uploadZone.style.borderColor = 'var(--primary-color)';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (fileInput.files.length === 0) {
      alert("Por favor, anexe uma fatura ou extrato.");
      return;
    }

    const tipoDoc = document.getElementById('f-tipo-doc').value;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Processando IA (Gemini Vision)...';

    // Mock de processamento OCR com IA com resposta dinâmica baseada no tipo
    setTimeout(() => {
      let mockLLMResponse = [];
      let tituloRevisao = 'Leitura IA (OCR)';

      if (tipoDoc === 'cartao') {
        mockLLMResponse = [
          { data: '05/11', descricao: 'Uber do Brasil', valor: 25.50 },
          { data: '06/11', descricao: 'Ifood *Hamburgueria', valor: 68.90 },
          { data: '12/11', descricao: 'Posto Ipiranga', valor: 250.00 }
        ];
        tituloRevisao = 'Fatura de Cartão Processada';
      } else if (tipoDoc === 'consumo') {
        mockLLMResponse = [
          { data: '10/11', descricao: 'Conta de Energia Elétrica (Enel)', valor: 145.20 }
        ];
        tituloRevisao = 'Conta de Consumo Lida';
      } else if (tipoDoc === 'nota_fiscal') {
        mockLLMResponse = [
          { data: '15/11', descricao: 'Arroz 5kg', valor: 25.90 },
          { data: '15/11', descricao: 'Feijão Carioca 1kg', valor: 8.50 },
          { data: '15/11', descricao: 'Detergente Líquido', valor: 2.30 },
          { data: '15/11', descricao: 'Papel Higiênico (Pct 12)', valor: 18.90 }
        ];
        tituloRevisao = 'Nota de Supermercado Processada';
      }

      abrirTelaRevisao(mockLLMResponse, tituloRevisao);
    }, 2500);
  });

  modalBackdrop.style.display = 'flex';
}

function abrirModalOpenFinance() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplOF = document.getElementById('tpl-open-finance');
  
  document.getElementById('modal-title').textContent = 'Open Finance';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplOF.content.cloneNode(true));

  const btnConectar = document.getElementById('btn-conectar-of');
  btnConectar.addEventListener('click', () => {
    btnConectar.disabled = true;
    btnConectar.textContent = 'Autenticando API do Banco... ⏳';
    
    // Mock de extração Open Finance API
    setTimeout(() => {
      const mockOFResponse = [
        { data: '15/11', descricao: 'Pix Recebido - João M.', valor: -450.00 }, // Negativo = Crédito
        { data: '16/11', descricao: 'Spotify Premium', valor: 21.90 },
        { data: '18/11', descricao: 'Farmácia Pague Menos', valor: 112.40 }
      ];
      abrirTelaRevisao(mockOFResponse, 'Extrato Open Finance');
    }, 2000);
  });

  modalBackdrop.style.display = 'flex';
}

function abrirTelaRevisao(itens, titulo) {
  const modalBody = document.getElementById('modal-body-content');
  const tplRevisao = document.getElementById('tpl-revisao-fatura');
  
  document.getElementById('modal-title').textContent = titulo;
  modalBody.innerHTML = '';
  modalBody.appendChild(tplRevisao.content.cloneNode(true));
  
  document.getElementById('ocr-count').textContent = itens.length;
  
  let soma = 0;
  const tbody = document.getElementById('lista-revisao-ocr');
  itens.forEach(item => {
    soma += item.valor;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.data}</td>
      <td><strong>${item.descricao}</strong></td>
      <td>${item.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById('ocr-total').textContent = soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  document.getElementById('btn-confirmar-fatura').addEventListener('click', () => {
    // Aqui aconteceria o POST em lote (batch) pro PostgreSQL
    alert('As transações foram gravadas com sucesso no seu orçamento geral!');
    document.getElementById('modal-backdrop').style.display = 'none';
    const event = new CustomEvent('routeChanged', { detail: { path: '/transacoes' } });
    document.dispatchEvent(event);
  });
}

function abrirDetalhesFatura(faturaId) {
  // Mock: Busca os detalhes no backend com base no ID da fatura clicada
  const mockDetalhes = [
    { data: '12/11', descricao: 'Restaurante Sabor', valor: 45.90 },
    { data: '13/11', descricao: 'Posto Shell', valor: 150.00 },
    { data: '14/11', descricao: 'Farmácia', valor: 34.50 },
    { data: '20/11', descricao: 'Netflix', valor: 39.90 }
  ];
  
  // Reutilizamos a mesma tela inteligente de Revisão!
  abrirTelaRevisao(mockDetalhes, 'Detalhes da Fatura / Extrato');
}

async function abrirModalAssinatura(id = null) {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-assinatura');
  
  document.getElementById('modal-title').textContent = id ? 'Editar Assinatura' : 'Nova Assinatura';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  if (id && CONFIG.USE_MOCKS) {
    const assinaturas = await appState.fetchAssinaturas();
    const ass = assinaturas.find(a => a.id === id);
    if (ass) {
      document.getElementById('a-nome').value = ass.servico;
      document.getElementById('a-valor').value = ass.valor;
      document.getElementById('a-dia').value = new Date(ass.proxima_cobranca).getUTCDate();
      document.getElementById('a-status').value = ass.status;
    }
  }

  const form = document.getElementById('form-assinatura');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    // Mock API
    setTimeout(() => {
      modalBackdrop.style.display = 'none';
      const event = new CustomEvent('routeChanged', { detail: { path: '/assinaturas' } });
      document.dispatchEvent(event);
    }, 500);
  });

  modalBackdrop.style.display = 'flex';
}

async function abrirModalInvestimento(id = null) {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-investimento');
  
  document.getElementById('modal-title').textContent = id ? 'Editar Aporte' : 'Novo Aporte';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));

  // Popula selects de Tipos e Contas
  const tipos = await appState.fetchTiposInvestimento();
  const contas = await appState.fetchContas();
  
  const selectTipo = document.getElementById('i-tipo');
  tipos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nome;
    selectTipo.appendChild(opt);
  });

  const selectConta = document.getElementById('i-conta');
  contas.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id_conta;
    opt.textContent = `${c.conta} (${c.banco || 'Físico'})`;
    selectConta.appendChild(opt);
  });
  
  if (id && CONFIG.USE_MOCKS) {
    const invs = await appState.fetchInvestimentos();
    const i = invs.find(a => a.id === id);
    if (i) {
      document.getElementById('i-ativo').value = i.ativo;
      document.getElementById('i-valor').value = i.valor_investido;
      document.getElementById('i-indexador').value = i.indexador;
    }
  }

  const form = document.getElementById('form-investimento');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Gravando...';

    setTimeout(() => {
      modalBackdrop.style.display = 'none';
      const event = new CustomEvent('routeChanged', { detail: { path: '/investimentos' } });
      document.dispatchEvent(event);
    }, 500);
  });

  modalBackdrop.style.display = 'flex';
}

function abrirModalNovaMeta() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-meta');
  
  document.getElementById('modal-title').textContent = 'Nova Meta';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  const form = document.getElementById('form-meta');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    setTimeout(() => {
      modalBackdrop.style.display = 'none';
      const event = new CustomEvent('routeChanged', { detail: { path: '/metas' } });
      document.dispatchEvent(event);
    }, 500);
  });

  modalBackdrop.style.display = 'flex';
}

async function abrirModalNovaCategoria() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-categoria');
  
  // Muda o título do Modal
  document.getElementById('modal-title').textContent = 'Nova Categoria';
  
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  // Popula o select de Grupos
  const grupos = await appState.fetchGrupos();
  const selectGrupo = document.getElementById('cat-grupo');
  grupos.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id_grupo;
    opt.textContent = g.grupo || g.nome;
    selectGrupo.appendChild(opt);
  });

  const form = document.getElementById('form-categoria');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
      nome_categoria: document.getElementById('cat-nome').value,
      id_grupo: document.getElementById('cat-grupo').value
    };

    try {
      await appState.salvarCategoria(payload);
      modalBackdrop.style.display = 'none';
      
      // Forçar recarregamento
      const event = new CustomEvent('routeChanged', { detail: { path: '/cadastros/categorias' } });
      document.dispatchEvent(event);
      
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Salvar Categoria';
    }
  });

  modalBackdrop.style.display = 'flex';
}

async function abrirModalNovoGrupo() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-grupo');
  
  document.getElementById('modal-title').textContent = 'Novo Grupo';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  // Popula o select de Centros de Custo
  const ccs = await appState.fetchCentrosCusto();
  const selectCC = document.getElementById('g-cc');
  ccs.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id_cc || c.id;
    opt.textContent = c.centro_custo || c.nome;
    selectCC.appendChild(opt);
  });

  const form = document.getElementById('form-grupo');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
      grupo: document.getElementById('g-nome').value,
      id_cc: document.getElementById('g-cc').value
    };

    try {
      if (!CONFIG.USE_MOCKS) {
        await appState.fetchAuth('/auxiliary/grupos', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      modalBackdrop.style.display = 'none';
      const event = new CustomEvent('routeChanged', { detail: { path: '/cadastros/categorias' } });
      document.dispatchEvent(event);
    } catch (err) {
      alert('Erro: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Salvar Grupo';
    }
  });

  modalBackdrop.style.display = 'flex';
}

async function abrirModalNovaConta() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-conta');
  
  document.getElementById('modal-title').textContent = 'Nova Conta / Cartão';
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  // Lógica de Busca de Bancos
  const bancos = await appState.fetchBancos();
  const inputBancoNome = document.getElementById('c-banco-nome');
  const inputBancoCodigo = document.getElementById('c-banco-codigo');
  const btnBuscarBanco = document.getElementById('btn-buscar-banco');
  const dropdown = document.getElementById('bancos-dropdown');
  const list = document.getElementById('bancos-list');

  // Renderizar a lista de bancos no dropdown
  bancos.forEach(b => {
    const li = document.createElement('li');
    // Usando as novas propriedades nome_curto e compe
    li.textContent = `${b.compe || ''} - ${b.nome_curto || b.nome_completo}`;
    li.addEventListener('click', () => {
      inputBancoNome.value = b.nome_curto || b.nome_completo;
      inputBancoCodigo.value = b.compe;
      dropdown.style.display = 'none';
    });
    list.appendChild(li);
  });

  // Toggle do Dropdown ao clicar na Lupa
  btnBuscarBanco.addEventListener('click', () => {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });

  // Filtro no input para pesquisar no dropdown
  inputBancoNome.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    dropdown.style.display = 'block'; // Mostra ao digitar
    
    // Limpa código se usuário apagar ou digitar livremente
    inputBancoCodigo.value = '';

    const items = list.querySelectorAll('li');
    items.forEach(li => {
      const text = li.textContent.toLowerCase();
      li.style.display = text.includes(term) ? 'block' : 'none';
    });
  });

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#bancos-dropdown') && e.target !== btnBuscarBanco && e.target !== inputBancoNome) {
      if (dropdown) dropdown.style.display = 'none';
    }
  });

  const form = document.getElementById('form-conta');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
      conta: document.getElementById('c-nome').value,
      banco: document.getElementById('c-banco-nome').value || null, // Pode ser null para Carteira
      agencia: document.getElementById('c-agencia').value || null,
      num_conta: document.getElementById('c-num').value || null,
      digito: document.getElementById('c-digito').value || null
    };

    try {
      if (!CONFIG.USE_MOCKS) {
        await appState.fetchAuth('/auxiliary/contas', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      modalBackdrop.style.display = 'none';
      const event = new CustomEvent('routeChanged', { detail: { path: '/cadastros/contas' } });
      document.dispatchEvent(event);
    } catch (err) {
      alert('Erro: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Salvar Conta';
    }
  });

  modalBackdrop.style.display = 'flex';
}

function abrirModalSimples(title, tipo) {
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = document.getElementById('modal-body-content');
  const tplForm = document.getElementById('tpl-form-simples');
  
  document.getElementById('modal-title').textContent = title;
  modalBody.innerHTML = '';
  modalBody.appendChild(tplForm.content.cloneNode(true));
  
  document.getElementById('label-nome-simples').textContent = 'Nome (' + tipo + ')';
  
  const form = document.getElementById('form-simples');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    
    // Aqui acionaríamos a API dependendo do `tipo`
    setTimeout(() => {
      modalBackdrop.style.display = 'none';
      const event = new CustomEvent('routeChanged', { detail: { path: window.location.hash.replace('#', '') } });
      document.dispatchEvent(event);
    }, 400); // Simulando o tempo de resposta da API
  });

  modalBackdrop.style.display = 'flex';
}

function setupThemeToggle() {
  const btnTheme = document.getElementById('btn-theme-toggle');
  if (!btnTheme) return;
  
  const iconMoon = btnTheme.querySelector('.icon-moon');
  const iconSun = btnTheme.querySelector('.icon-sun');
  
  // Verifica localStorage ou preferência do sistema
  const currentTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    iconMoon.style.display = 'none';
    iconSun.style.display = 'inline';
  }

  btnTheme.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      iconMoon.style.display = 'inline';
      iconSun.style.display = 'none';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      iconMoon.style.display = 'none';
      iconSun.style.display = 'inline';
    }
    
    // Forçar atualização do gráfico se existir
    const event = new CustomEvent('themeChanged');
    document.dispatchEvent(event);
  });
}
