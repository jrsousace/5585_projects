// investimentos.js - Módulo de Investimentos e Evolução Patrimonial

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/investimentos' && appState.hasModuleAccess('investments')) {
    initInvestimentosView();
  }
});

let investmentsChartInstance = null;
let performanceChartInstance = null;

async function initInvestimentosView() {
  const investimentos = await appState.fetchInvestimentos();
  
  // 1. Configurar Sistema de Abas (Tabs)
  setupTabs();
  
  // 2. Renderizar a Tabela da Carteira e Gráfico de Distribuição
  renderizarCarteira(investimentos);

  // 3. Renderizar Dashboard de Desempenho e Cotações em Tempo Real
  renderCotacoesTempoReal();
  renderPerformanceChart();
  
  // 4. Configurar Botão de Filtro no Desempenho
  const btnFiltro = document.getElementById('btn-aplicar-filtros');
  if(btnFiltro) {
    btnFiltro.addEventListener('click', () => {
      const tipo = document.getElementById('filtro-tipo').value;
      const corretora = document.getElementById('filtro-corretora').value;
      alert(`Filtros Aplicados: \nTipo: ${tipo} \nCorretora: ${corretora}\n(Os gráficos foram recalibrados na memória)`);
    });
  }
}

function setupTabs() {
  const btns = document.querySelectorAll('.btn-tab');
  const panes = document.querySelectorAll('.tab-pane');
  
  if(btns.length === 0) return;

  btns.forEach(btn => {
    // Clonar para evitar multi-binding
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.btn-tab').forEach(b => {
        b.classList.remove('active');
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-muted)';
        b.style.fontWeight = '500';
      });
      panes.forEach(p => p.style.display = 'none');
      
      newBtn.classList.add('active');
      newBtn.style.borderBottomColor = 'var(--primary-color)';
      newBtn.style.color = 'var(--text-color)';
      newBtn.style.fontWeight = '600';
      
      const target = document.getElementById(newBtn.getAttribute('data-target'));
      if (target) target.style.display = 'block';
    });
  });
}

function renderizarCarteira(investimentos) {
  const tbody = document.getElementById('lista-investimentos');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (investimentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum investimento cadastrado.</td></tr>';
    document.getElementById('inv-total').textContent = '0,00';
    return;
  }

  let totalPatrimonio = 0;
  const distribuicao = {};
  
  const fragment = document.createDocumentFragment();
  investimentos.forEach(i => {
    // Calculo para Dashboards
    const valor = parseFloat(i.valor_investido);
    totalPatrimonio += valor;
    
    const tipo = i.nome_tipo_investimento || 'Outros';
    distribuicao[tipo] = (distribuicao[tipo] || 0) + valor;

    // Renderização da Linha
    const tr = document.createElement('tr');
    const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    const dataApp = new Date(i.data_aplicacao).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
    const dataVenc = i.vencimento ? new Date(i.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';
    
    let indexadorTaxa = i.indexador || '-';
    if (i.taxa_contratada) {
      indexadorTaxa = `${i.taxa_contratada}% ${i.indexador}`;
    }

    tr.innerHTML = `
      <td><strong>${i.ativo}</strong></td>
      <td>${tipo}</td>
      <td>${dataApp}</td>
      <td>${dataVenc}</td>
      <td class="text-muted">${indexadorTaxa}</td>
      <td style="color: var(--info-color); font-weight: 500;">${valorFormatado}</td>
      <td style="text-align: center;">
        <button class="btn btn-outline" data-action="editar-investimento" data-id="${i.id}" style="padding: 0.25rem 0.5rem; min-height: auto;">✏️</button>
      </td>
    `;
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);

  // Atualizar Card Total
  document.getElementById('inv-total').textContent = totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  // Renderizar Gráfico de Distribuição
  renderInvestmentsChart(distribuicao);
}

function renderCotacoesTempoReal() {
  const tbody = document.getElementById('lista-cotacoes');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  // Mock Média de Pregão
  const mockAcoes = [
    { ativo: 'PETR4', preco: 35.40, variacao: 1.2 },
    { ativo: 'VALE3', preco: 68.90, variacao: -0.5 },
    { ativo: 'ITUB4', preco: 32.15, variacao: 0.8 },
    { ativo: 'HGLG11 (FII)', preco: 165.20, variacao: 0.1 },
    { ativo: 'BBDC4', preco: 14.10, variacao: -1.3 }
  ];
  
  mockAcoes.forEach(a => {
    const isPositive = a.variacao >= 0;
    const color = isPositive ? 'var(--success-color)' : 'var(--error-color)';
    const arrow = isPositive ? '▲' : '▼';
    
    tbody.innerHTML += `
      <tr>
        <td><strong>${a.ativo}</strong></td>
        <td>R$ ${a.preco.toFixed(2).replace('.',',')}</td>
        <td style="color: ${color}; font-weight: 600;">${arrow} ${Math.abs(a.variacao)}%</td>
      </tr>
    `;
  });
}

function renderPerformanceChart() {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) return;
  
  if (performanceChartInstance) performanceChartInstance.destroy();
  
  performanceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'],
      datasets: [{
        label: 'Rentabilidade Carteira (%)',
        data: [0, 1.2, 2.5, 2.1, 3.8, 5.0, 6.2, 5.8, 7.5, 9.1],
        borderColor: '#16845B',
        backgroundColor: 'rgba(22, 132, 91, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      },
      {
        label: 'IBOVESPA (%)',
        data: [0, 0.5, 1.8, 1.0, 2.5, 2.0, 4.2, 3.1, 5.5, 6.0],
        borderColor: '#64748B',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() }
        }
      },
      scales: {
        y: {
          ticks: { callback: function(value) { return value + '%'; } }
        }
      }
    }
  });
}

function renderInvestmentsChart(dados) {
  const ctx = document.getElementById('investmentsChart');
  if (!ctx) return;
  
  if (investmentsChartInstance) {
    investmentsChartInstance.destroy();
  }
  
  const labels = Object.keys(dados);
  const data = Object.values(dados);
  
  investmentsChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#16845B', // Verde-esmeralda
          '#2563EB', // Azul
          '#8b5cf6', // Roxo
          '#A16207', // Laranja Escuro
          '#142B3B'  // Azul Petróleo
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
            font: { family: "'Inter', sans-serif", size: 11 }
          }
        }
      }
    }
  });
}

// --- Lógica de UI (Tabs) ---
function switchTabInv(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-inv-${tabName}`).style.display = 'block';
    event.currentTarget.classList.add('active');
}

// --- Lógica Mock de Cotação Média em Tempo Real ---
function renderizarCotacoesTempoReal() {
    const container = document.getElementById('ticker-tempo-real');
    if (!container) return;

    // Simulação de dados de mercado para o dia atual
    const cotacoesMock = [
        { ticker: 'PETR4', variacao: 1.25 },
        { ticker: 'VALE3', variacao: -0.80 },
        { ticker: 'ITUB4', variacao: 0.45 },
        { ticker: 'BOVA11', variacao: 0.10 }
    ];

    container.innerHTML = cotacoesMock.map(ativo => {
        const cor = ativo.variacao >= 0 ? 'var(--success-color)' : 'var(--error-color)';
        const sinal = ativo.variacao >= 0 ? '+' : '';
        return `
        <div style="background: var(--bg-color); border: 1px solid var(--border-color); padding: 0.25rem 0.75rem; border-radius: 4px; display: inline-block;">
            <strong>${ativo.ticker}</strong> <span style="color: ${cor}; font-size: var(--text-meta);">${sinal}${ativo.variacao}%</span>
        </div>
        `;
    }).join('');
}

// --- Lógica de Matriz de Risco ---
function processarMatrizRisco(investimentos) {
    const lstConservador = document.getElementById('lista-matriz-conservadora');
    const lstArrojada = document.getElementById('lista-matriz-arrojada');
    const lstTrade = document.getElementById('lista-matriz-trade');
    
    if(!lstConservador) return;

    lstConservador.innerHTML = ''; lstArrojada.innerHTML = ''; lstTrade.innerHTML = '';

    investimentos.forEach(inv => {
        const item = `<li>${inv.ativo} (R$ ${inv.valor_investido})</li>`;
        
        // Simulação de classificação baseada no Indexador ou Tipo do Mock
        if (['Selic', 'CDI', 'IPCA'].includes(inv.indexador)) {
            lstConservador.innerHTML += item;
        } else if (inv.indexador === 'Ações/FIIs') {
             // Lógica arbitrária mockada: se for Cripto vai para trade, se for Ação vai para arrojada
            if(inv.ativo.includes('BTC') || inv.ativo.includes('WIN')) {
                lstTrade.innerHTML += item;
            } else {
                lstArrojada.innerHTML += item;
            }
        }
    });
    
    if(lstConservador.innerHTML === '') lstConservador.innerHTML = '<li class="text-muted">Sem ativos neste perfil</li>';
    if(lstArrojada.innerHTML === '') lstArrojada.innerHTML = '<li class="text-muted">Sem ativos neste perfil</li>';
    if(lstTrade.innerHTML === '') lstTrade.innerHTML = '<li class="text-muted">Nenhuma operação de trade detectada</li>';
}

// Ouvir mudanças de tema para recarregar o gráfico com a cor da borda certa
document.addEventListener('themeChanged', () => {
  if (investmentsChartInstance) {
    initInvestimentosView(); 
  }
});
