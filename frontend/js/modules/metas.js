// metas.js - Módulo de Orçamento Mensal e Metas Longo Prazo

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/metas' && appState.hasModuleAccess('premium')) {
    initMetasView();
  }
});

async function initMetasView() {
  setupTabsMetas();
  await renderOrcamentoMensal();
  await renderMetasLongoPrazo();
}

function setupTabsMetas() {
  const btns = document.querySelectorAll('.btn-tab');
  const panes = document.querySelectorAll('.tab-pane');
  
  btns.forEach(btn => {
    if(btn.getAttribute('data-target')?.startsWith('tab-orc') || btn.getAttribute('data-target')?.startsWith('tab-metas')) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', () => {
        document.querySelectorAll('.btn-tab').forEach(b => {
          if(b.getAttribute('data-target')?.startsWith('tab-orc') || b.getAttribute('data-target')?.startsWith('tab-metas')) {
            b.classList.remove('active');
            b.style.borderBottomColor = 'transparent';
            b.style.color = 'var(--text-muted)';
            b.style.fontWeight = '500';
          }
        });
        
        document.getElementById('tab-orc-mensal').style.display = 'none';
        document.getElementById('tab-metas-longo').style.display = 'none';
        
        newBtn.classList.add('active');
        newBtn.style.borderBottomColor = 'var(--primary-color)';
        newBtn.style.color = 'var(--text-color)';
        newBtn.style.fontWeight = '600';
        
        const target = document.getElementById(newBtn.getAttribute('data-target'));
        if (target) target.style.display = 'block';
      });
    }
  });
}

async function renderOrcamentoMensal() {
  const dados = await appState.fetchOrcamentoMensal();
  
  const gastoEl = document.getElementById('orc-gasto');
  const tetoEl = document.getElementById('orc-teto');
  const barra = document.getElementById('orc-progress-bar');
  
  gastoEl.textContent = dados.gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  tetoEl.textContent = dados.teto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  let pct = 0;
  if (dados.teto > 0) {
    pct = (dados.gasto / dados.teto) * 100;
  }
  
  if (pct > 100) pct = 100;
  
  barra.style.width = `${pct}%`;
  
  if (pct < 75) {
    barra.style.backgroundColor = 'var(--success-color)';
  } else if (pct < 95) {
    barra.style.backgroundColor = 'var(--warning-color)';
  } else {
    barra.style.backgroundColor = 'var(--error-color)';
  }

  renderCalendarioAcordeao();
}

function renderCalendarioAcordeao() {
  const acc = document.getElementById('orc-calendario-accordion');
  if(!acc) return;
  acc.innerHTML = '';
  
  // Agrupamento por Mês/Ano e depois por Dia
  const meses = [
    {
      mes_ano: 'Outubro / 2026', total: 4600.00,
      dias: [
        { dia: '15/10/2026', total: -150.00, itens: ['Supermercado (R$ 100,00)', 'Farmácia (R$ 50,00)'] },
        { dia: '14/10/2026', total: 5000.00, itens: ['Salário (R$ 5000,00)'] },
        { dia: '10/10/2026', total: -250.00, itens: ['Conta de Luz (R$ 150,00)', 'Internet (R$ 100,00)'] }
      ]
    },
    {
      mes_ano: 'Setembro / 2026', total: -800.00,
      dias: [
        { dia: '28/09/2026', total: -800.00, itens: ['Seguro do Carro (R$ 800,00)'] }
      ]
    }
  ];

  meses.forEach(m => {
    const isMesPos = m.total >= 0;
    const corMes = isMesPos ? 'var(--success-color)' : 'var(--error-color)';
    const sinalMes = isMesPos ? '+' : '-';
    const valorMesFmt = Math.abs(m.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let htmlDias = '';
    m.dias.forEach(d => {
      const isDespesa = d.total < 0;
      const corDia = isDespesa ? 'var(--error-color)' : 'var(--success-color)';
      const valorDiaFmt = Math.abs(d.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const sinalDia = isDespesa ? '-' : '+';
      
      htmlDias += `
        <div style="margin-top: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: 0.5rem 1rem; background: rgba(0,0,0,0.02); display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color);">
            <strong style="color: var(--text-color);">🗓️ ${d.dia}</strong>
            <strong style="color: ${corDia};">${sinalDia} ${valorDiaFmt}</strong>
          </div>
          <ul style="list-style: none; margin: 0; padding: 0.5rem 1rem; color: var(--text-muted); font-size: var(--text-body); background: var(--surface-color);">
            ${d.itens.map(item => `<li style="padding: 0.25rem 0; border-bottom: 1px solid var(--border-color);">${item}</li>`).join('')}
          </ul>
        </div>
      `;
    });

    acc.innerHTML += `
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 1rem; overflow: hidden;">
        <button class="nav-accordion-btn" style="width: 100%; margin: 0; border-radius: 0; background: var(--surface-color);" onclick="this.classList.toggle('active'); const n = this.nextElementSibling; n.style.display = n.style.display === 'none' ? 'block' : 'none';">
          <span style="font-weight: 600; font-size: 1.1rem;">📅 ${m.mes_ano}</span>
          <span style="color: ${corMes}; font-weight: 600; font-size: 1.1rem;">${sinalMes} ${valorMesFmt} <span class="arrow" style="margin-left: 1rem;">▼</span></span>
        </button>
        <div class="nav-submenu" style="display: none; padding: 1rem; background: var(--bg-color);">
          ${htmlDias}
        </div>
      </div>
    `;
  });
}

async function renderMetasLongoPrazo() {
  const metas = await appState.fetchMetas();
  const container = document.getElementById('lista-metas-cards');
  if(!container) return;
  container.innerHTML = '';

  metas.forEach(m => {
    const pct = (m.atual / m.alvo) * 100;
    const isCompleted = pct >= 100;
    const icon = isCompleted ? '🎉' : '🎯';
    const linkMsg = m.vinculo !== 'none' ? '🔄 Sincronizado com Investimento' : '✏️ Atualização Manual';
    
    container.innerHTML += `
      <div class="card" style="border-top: 4px solid ${isCompleted ? 'var(--success-color)' : 'var(--info-color)'};">
        <h3 style="display: flex; justify-content: space-between;">
          <span>${icon} ${m.nome}</span>
          <span>${pct.toFixed(0)}%</span>
        </h3>
        <p class="text-muted text-meta mt-2">${linkMsg}</p>
        
        <div style="width: 100%; background-color: var(--border-color); height: 6px; border-radius: 3px; margin: 1rem 0;">
          <div style="width: ${Math.min(pct, 100)}%; height: 100%; background-color: ${isCompleted ? 'var(--success-color)' : 'var(--info-color)'}; border-radius: 3px;"></div>
        </div>
        
        <div style="display: flex; justify-content: space-between;" class="text-meta">
          <span>Atual: R$ ${m.atual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
          <span class="text-muted">Alvo: R$ ${m.alvo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
      </div>
    `;
  });
}
