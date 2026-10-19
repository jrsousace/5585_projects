// assinaturas.js - Módulo Premium de Assinaturas e Recorrências

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/assinaturas' && appState.hasModuleAccess('premium')) {
    initAssinaturasView();
  }
});

async function initAssinaturasView() {
  const assinaturas = await appState.fetchAssinaturas();
  const tbody = document.getElementById('lista-assinaturas');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (assinaturas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma assinatura cadastrada.</td></tr>';
    return;
  }

  let totalMensal = 0;
  let datasRenovacao = [];
  
  const fragment = document.createDocumentFragment();
  assinaturas.forEach(a => {
    if (a.status === 'Ativo') {
      totalMensal += a.valor;
      datasRenovacao.push(new Date(a.proxima_cobranca));
    }

    const tr = document.createElement('tr');
    const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.valor);
    const dataRenovacao = new Date(a.proxima_cobranca).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
    
    let statusBadge = `<span style="color: var(--success-color)">● Ativo</span>`;
    if (a.status === 'Pausado') statusBadge = `<span style="color: var(--warning-color)">⏸ Pausado</span>`;
    
    tr.innerHTML = `
      <td><strong>${a.servico}</strong></td>
      <td>${a.categoria}</td>
      <td>${dataRenovacao}</td>
      <td style="color: var(--error-color)">${valor}</td>
      <td>${statusBadge}</td>
      <td style="text-align: center;">
        <button class="btn btn-outline" data-action="editar-assinatura" data-id="${a.id}" style="padding: 0.25rem 0.5rem; min-height: auto;">✏️</button>
      </td>
    `;
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);

  // Preencher os Cards Superiores
  document.getElementById('ass-total').textContent = totalMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  if (datasRenovacao.length > 0) {
    // Ordena as datas pra achar a mais próxima
    datasRenovacao.sort((a,b) => a - b);
    document.getElementById('ass-prox').textContent = datasRenovacao[0].toLocaleDateString('pt-BR', {timeZone: 'UTC'});
  }
}
