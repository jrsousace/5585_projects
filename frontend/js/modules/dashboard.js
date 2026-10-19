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
  
  // Cores semânticas conforme a paleta (O Card Featured agora controla a cor do saldo)
  const saldoElement = document.getElementById('dash-saldo');
  saldoElement.textContent = saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  document.getElementById('dash-despesas').textContent = totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  // A cor já foi fixada no HTML para a despesa, usando var(--error-color) no style inline, mas deixamos fluida na estrutura

  // 2. Renderizar Gráfico de Pizza (Chart.js)
  renderChart(despesasPorCategoria);
}

// Ouvir mudanças de tema para recarregar o gráfico com novas cores
document.addEventListener('themeChanged', () => {
  if (expensesChartInstance) {
    // Redesenhar pegando as variáveis do root
    initDashboard(); 
  }
});

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
          '#16845B', // Verde-esmeralda
          '#2563EB', // Informação (Azul)
          '#A16207', // Warning
          '#0D261C', // Verde-pinho escuro
          '#64748B', // Cinza Secundário
          '#C2414B', // Despesa/Perigo
          '#153A2A'  // Verde escuro intermediário
        ],
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface-color').trim()
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
            font: {
              family: "'Inter', sans-serif"
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}
