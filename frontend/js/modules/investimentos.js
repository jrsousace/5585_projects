// investimentos.js - Módulo de Investimentos e Evolução Patrimonial

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/investimentos' && appState.hasModuleAccess('investments')) {
    initInvestimentosView();
  }
});

let investmentsChartInstance = null;

async function initInvestimentosView() {
  const investimentos = await appState.fetchInvestimentos();
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

// Ouvir mudanças de tema para recarregar o gráfico com a cor da borda certa
document.addEventListener('themeChanged', () => {
  if (investmentsChartInstance) {
    initInvestimentosView(); 
  }
});
