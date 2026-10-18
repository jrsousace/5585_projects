// budget.js - Módulo de Orçamento Doméstico (Fase 4)

document.addEventListener('routeChanged', (e) => {
  const { path, route } = e.detail;
  
  if (path === '/orcamento' && appState.hasModuleAccess('budget')) {
    initBudgetModule();
  }
});

async function initBudgetModule() {
  let transactions = [];
  
  if (CONFIG.USE_MOCKS) {
    // Simular busca na API (Mocks)
    transactions = await mockFetchTransactions();
  } else {
    // Chamada real ao Backend usando o helper fetchAuth (Fase 3)
    try {
      transactions = await appState.fetchAuth('/budget/transactions');
    } catch (err) {
      console.error('Erro ao carregar transações reais:', err);
    }
  }
  
  // Guardar no estado global
  appState.budget.transactions = transactions;
  
  // Renderizar a tabela com DocumentFragment para performance
  renderTransactionsTable(transactions);
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('lista-transacoes');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma transação encontrada</td></tr>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  transactions.forEach(t => {
    const tr = document.createElement('tr');
    
    // Formatando valores e data
    const date = new Date(t.data_evento).toLocaleDateString('pt-BR');
    const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor_total);
    const valueColor = t.tipo === 'despesa' ? 'var(--error-color)' : 'var(--success-color)';
    const formaPg = t.forma_pagamento || '-';
    
    tr.innerHTML = `
      <td>${date}</td>
      <td>${t.descricao}</td>
      <td>${t.categoria || '-'}</td>
      <td>${formaPg}</td>
      <td style="color: ${valueColor}">${value}</td>
      <td>
        <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; min-height: auto;" data-action="edit-transacao" data-id="${t.id_transacao}">✏️</button>
      </td>
    `;
    
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
}

// Mock da API para testar a renderização
function mockFetchTransactions() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        {
          id_transacao: 'uuid-1',
          data_evento: '2023-10-15',
          descricao: 'Supermercado',
          categoria: 'Alimentação',
          forma_pagamento: 'Cartão de Crédito',
          valor_total: 450.00,
          tipo: 'despesa'
        },
        {
          id_transacao: 'uuid-2',
          data_evento: '2023-10-16',
          descricao: 'Salário',
          categoria: 'Renda Fixa',
          forma_pagamento: 'PIX',
          valor_total: 5000.00,
          tipo: 'receita'
        },
        {
          id_transacao: 'uuid-3',
          data_evento: '2023-10-18',
          descricao: 'Conta de Luz',
          categoria: 'Moradia',
          forma_pagamento: 'Débito Automático',
          valor_total: 120.50,
          tipo: 'despesa'
        }
      ]);
    }, 400);
  });
}
