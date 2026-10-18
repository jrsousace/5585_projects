// dashboard.js - Lógica do Dashboard Inicial

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/') {
    initDashboard();
  }
});

let expensesChartInstance = null;

async function initDashboard() {
  let transactions = [];
  
  if (CONFIG.USE_MOCKS) {
    transactions = [
      { tipo: 'despesa', valor_total: 450, categoria: 'Alimentação' },
      { tipo: 'receita', valor_total: 5000, categoria: 'Salário' },
      { tipo: 'despesa', valor_total: 120, categoria: 'Moradia' },
      { tipo: 'despesa', valor_total: 300, categoria: 'Transporte' },
    ];
  } else {
    try {
      transactions = await appState.fetchAuth('/budget/transactions');
    } catch (error) {
      console.error('Erro ao carregar transações no dashboard');
    }
  }

  // 1. Atualizar Cards (Saldo e Despesas do Mês)
  let totalReceitas = 0;
  let totalDespesas = 0;
  
  // Estrutura para agrupar despesas por categoria para o Gráfico
  const despesasPorCategoria = {};

  transactions.forEach(t => {
    const valor = parseFloat(t.valor_total) || 0;
    if (t.tipo === 'receita') {
      totalReceitas += valor;
    } else {
      totalDespesas += valor;
      
      const cat = t.categoria || 'Outros';
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + valor;
    }
  });

  const saldo = totalReceitas - totalDespesas;
  
  document.getElementById('dash-saldo').textContent = saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('dash-despesas').textContent = totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  // 2. Renderizar Gráfico de Pizza (Chart.js)
  renderChart(despesasPorCategoria);
}

function renderChart(dadosAgrupados) {
  const ctx = document.getElementById('expensesChart');
  if (!ctx) return;
  
  // Destruir gráfico anterior se existir (evitar sobreposição)
  if (expensesChartInstance) {
    expensesChartInstance.destroy();
  }
  
  const labels = Object.keys(dadosAgrupados);
  const data = Object.values(dadosAgrupados);
  
  if (labels.length === 0) {
    // Sem despesas para renderizar
    return;
  }

  expensesChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#ef4444', // Red
          '#f97316', // Orange
          '#eab308', // Yellow
          '#3b82f6', // Blue
          '#8b5cf6', // Violet
          '#14b8a6', // Teal
          '#64748b'  // Slate
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        }
      }
    }
  });
}
