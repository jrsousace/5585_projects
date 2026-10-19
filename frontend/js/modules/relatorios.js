// relatorios.js - Módulo de Relatórios e Dashboards Dinâmicos

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path.startsWith('/relatorios/') && appState.hasModuleAccess('premium')) {
    initRelatorioView(path);
  }
});

let relatorioChartInstance = null;

async function initRelatorioView(path) {
  const titleEl = document.getElementById('rel-title');
  const descEl = document.getElementById('rel-desc');
  const thead = document.getElementById('rel-table-head');
  const tbody = document.getElementById('rel-table-body');
  
  // Limpeza de estado
  thead.innerHTML = '';
  tbody.innerHTML = '';
  if (relatorioChartInstance) relatorioChartInstance.destroy();

  const periodo = document.getElementById('rel-filtro-periodo').value || '12m';

  // --- ROTA: FLUXO DE CAIXA ---
  if (path === '/relatorios/fluxo') {
    titleEl.textContent = 'Fluxo de Caixa';
    descEl.textContent = 'Entradas vs Saídas ao longo do tempo.';
    
    thead.innerHTML = `<tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr>`;
    
    // Mock de Dados
    const mockData = [
      { mes: 'Jul/2026', rec: 5200, des: 4800 },
      { mes: 'Ago/2026', rec: 5200, des: 5050 },
      { mes: 'Set/2026', rec: 5800, des: 4500 },
      { mes: 'Out/2026', rec: 5200, des: 4600 }
    ];

    const chartLabels = [];
    const chartRec = [];
    const chartDes = [];

    mockData.forEach(d => {
      chartLabels.push(d.mes);
      chartRec.push(d.rec);
      chartDes.push(d.des);

      const result = d.rec - d.des;
      const color = result >= 0 ? 'var(--success-color)' : 'var(--error-color)';
      
      tbody.innerHTML += `
        <tr>
          <td><strong>${d.mes}</strong></td>
          <td style="color: var(--success-color)">R$ ${d.rec.toLocaleString('pt-BR')}</td>
          <td style="color: var(--error-color)">R$ ${d.des.toLocaleString('pt-BR')}</td>
          <td style="color: ${color}; font-weight: 600;">R$ ${result.toLocaleString('pt-BR')}</td>
        </tr>
      `;
    });

    renderChart('bar', chartLabels, [
      { label: 'Receitas', data: chartRec, backgroundColor: '#16845B' },
      { label: 'Despesas', data: chartDes, backgroundColor: '#C2414B' }
    ]);
  }

  // --- ROTA: ANÁLISE DE DESPESAS ---
  else if (path === '/relatorios/despesas') {
    titleEl.textContent = 'Análise de Despesas';
    descEl.textContent = 'Para onde seu dinheiro está indo.';
    
    thead.innerHTML = `<tr><th>Categoria</th><th>Valor Total</th><th>% do Gasto</th></tr>`;
    
    const mockData = [
      { cat: 'Moradia', valor: 2500 },
      { cat: 'Alimentação', valor: 1200 },
      { cat: 'Transporte', valor: 450 },
      { cat: 'Assinaturas', valor: 210 },
      { cat: 'Lazer', valor: 600 }
    ];

    const total = mockData.reduce((acc, curr) => acc + curr.valor, 0);
    const chartLabels = [];
    const chartData = [];

    mockData.sort((a,b) => b.valor - a.valor).forEach(d => {
      chartLabels.push(d.cat);
      chartData.push(d.valor);
      
      const pct = ((d.valor / total) * 100).toFixed(1);
      
      tbody.innerHTML += `
        <tr>
          <td><strong>${d.cat}</strong></td>
          <td style="color: var(--error-color)">R$ ${d.valor.toLocaleString('pt-BR')}</td>
          <td class="text-muted">${pct}%</td>
        </tr>
      `;
    });

    renderChart('doughnut', chartLabels, [{
      data: chartData,
      backgroundColor: ['#16845B', '#2563EB', '#A16207', '#C2414B', '#8b5cf6'],
      borderWidth: 2,
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface-color').trim()
    }]);
  }

  // --- ROTA: EVOLUÇÃO PATRIMONIAL ---
  else if (path === '/relatorios/patrimonio') {
    titleEl.textContent = 'Evolução Patrimonial';
    descEl.textContent = 'Crescimento da sua riqueza (Ativos - Passivos).';
    
    thead.innerHTML = `<tr><th>Data de Fechamento</th><th>Total de Ativos</th><th>Passivos (Dívidas)</th><th>Patrimônio Líquido</th></tr>`;
    
    const mockData = [
      { mes: 'Jan/2026', ativos: 45000, passivos: 12000 },
      { mes: 'Abr/2026', ativos: 52000, passivos: 10000 },
      { mes: 'Jul/2026', ativos: 61000, passivos: 8000 },
      { mes: 'Out/2026', ativos: 72400, passivos: 5500 }
    ];

    const chartLabels = [];
    const chartPL = [];

    mockData.forEach(d => {
      const pl = d.ativos - d.passivos;
      chartLabels.push(d.mes);
      chartPL.push(pl);

      tbody.innerHTML += `
        <tr>
          <td><strong>${d.mes}</strong></td>
          <td>R$ ${d.ativos.toLocaleString('pt-BR')}</td>
          <td>R$ ${d.passivos.toLocaleString('pt-BR')}</td>
          <td style="color: var(--primary-color); font-weight: 600;">R$ ${pl.toLocaleString('pt-BR')}</td>
        </tr>
      `;
    });

    renderChart('line', chartLabels, [{
      label: 'Patrimônio Líquido',
      data: chartPL,
      borderColor: '#2563EB',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      fill: true,
      tension: 0.4
    }]);
  }

  // --- ROTA: PERFORMANCE DE INVESTIMENTOS ---
  else if (path === '/relatorios/performance') {
    titleEl.textContent = 'Performance de Investimentos';
    descEl.textContent = 'Como sua carteira se comporta perante o mercado.';
    
    thead.innerHTML = `<tr><th>Mês</th><th>Sua Carteira</th><th>IBOVESPA</th><th>CDI</th></tr>`;
    
    const mockData = [
      { mes: 'Jul', cart: 1.2, ibov: 0.8, cdi: 0.9 },
      { mes: 'Ago', cart: 2.1, ibov: -1.2, cdi: 0.9 },
      { mes: 'Set', cart: 0.5, ibov: 1.5, cdi: 0.85 },
      { mes: 'Out', cart: 3.4, ibov: 2.1, cdi: 0.85 }
    ];

    const chartLabels = mockData.map(d => d.mes);
    
    mockData.forEach(d => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${d.mes}</strong></td>
          <td style="color: ${d.cart >= 0 ? 'var(--success-color)' : 'var(--error-color)'}">${d.cart}%</td>
          <td class="text-muted">${d.ibov}%</td>
          <td class="text-muted">${d.cdi}%</td>
        </tr>
      `;
    });

    renderChart('bar', chartLabels, [
      { label: 'Sua Carteira', data: mockData.map(d => d.cart), backgroundColor: '#16845B' },
      { label: 'IBOVESPA', data: mockData.map(d => d.ibov), backgroundColor: '#64748B' }
    ]);
  }
}

function renderChart(type, labels, datasets) {
  const ctx = document.getElementById('relatorioChart');
  if (!ctx) return;
  
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
  
  relatorioChartInstance = new Chart(ctx, {
    type: type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: type === 'doughnut' ? 'right' : 'top',
          labels: { color: textColor, font: { family: "'Inter', sans-serif" } }
        }
      },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { color: textColor } },
        y: { ticks: { color: textColor } }
      },
      cutout: type === 'doughnut' ? '65%' : undefined
    }
  });
}

// Ouvir mudança de tema para atualizar cor das fontes e bordas do gráfico
document.addEventListener('themeChanged', () => {
  if (relatorioChartInstance) {
    const path = window.location.hash.replace('#', '');
    if (path.startsWith('/relatorios/')) {
      initRelatorioView(path);
    }
  }
});
