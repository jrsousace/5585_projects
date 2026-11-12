// budget.js - Módulo de Orçamento Doméstico (Fase 4)

document.addEventListener('routeChanged', (e) => {
  const { path, route } = e.detail;
  
  if (path === '/transacoes' && appState.hasModuleAccess('budget')) {
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
    const date = new Date(t.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
    const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor_total);
    const valueColor = t.tipo === 'despesa' ? 'var(--error-color)' : 'var(--success-color)';
    const formaPg = t.forma_pagamento || '-';

    const appendCell = (text, className) => {
      const cell = document.createElement('td');
      cell.textContent = text;
      if (className) cell.className = className;
      tr.appendChild(cell);
      return cell;
    };
    const dateCell = appendCell(date);
    if (t.transacao_status === 'atrasado' || t.transacao_status === 'pendente') {
      const status = document.createElement('small');
      status.textContent = t.transacao_status === 'atrasado' ? 'Atrasado' : 'Pendente';
      status.style.color = t.transacao_status === 'atrasado'
        ? 'var(--error-color)'
        : 'var(--warning-color)';
      dateCell.appendChild(document.createElement('br'));
      dateCell.appendChild(status);
    }
    appendCell(t.descricao || '');
    appendCell(t.categoria || '-');
    appendCell(formaPg);
    const valueCell = appendCell(value);
    valueCell.style.color = valueColor;
    const actionsCell = document.createElement('td');
    actionsCell.style.whiteSpace = 'nowrap';
    if (t.transacao_status === 'pendente' || t.transacao_status === 'atrasado') {
      const payButton = document.createElement('button');
      payButton.className = 'btn btn-outline';
      payButton.style.cssText = 'padding: 0.25rem 0.5rem; min-height: auto; color: var(--success-color); border-color: var(--success-color); margin-right: 0.25rem;';
      payButton.dataset.action = 'pagar-transacao';
      payButton.dataset.id = t.id_transacao;
      payButton.dataset.valor = t.valor_total;
      payButton.title = 'Tornar Pago';
      payButton.textContent = '✔️ Pago';
      actionsCell.appendChild(payButton);
    }
    const editButton = document.createElement('button');
    editButton.className = 'btn btn-outline';
    editButton.style.cssText = 'padding: 0.25rem 0.5rem; min-height: auto;';
    editButton.dataset.action = 'edit-transacao';
    editButton.dataset.id = t.id_transacao;
    editButton.textContent = '✏️';
    actionsCell.appendChild(editButton);
    tr.appendChild(actionsCell);

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
          data_vencimento: '2023-10-15',
          data_pagamento: '2023-10-15',
          transacao_status: 'pago',
          descricao: 'Supermercado',
          categoria: 'Alimentação',
          forma_pagamento: 'Cartão de Crédito',
          valor_total: 450.00,
          tipo: 'despesa'
        },
        {
          id_transacao: 'uuid-2',
          data_vencimento: '2023-10-16',
          data_pagamento: '2023-10-16',
          transacao_status: 'pago',
          descricao: 'Salário',
          categoria: 'Renda Fixa',
          forma_pagamento: 'PIX',
          valor_total: 5000.00,
          tipo: 'receita'
        },
        {
          id_transacao: 'uuid-3',
          data_vencimento: '2023-10-18',
          data_pagamento: null,
          transacao_status: 'pendente',
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
