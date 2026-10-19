// faturas.js - Módulo Premium de Faturas e Importação OCR

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/faturas' && appState.hasModuleAccess('premium')) {
    initFaturasView();
  }
});

async function initFaturasView() {
  const faturas = await appState.fetchFaturas();
  const tbody = document.getElementById('lista-faturas');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (faturas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma fatura encontrada. Importe um arquivo.</td></tr>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  faturas.forEach(f => {
    const tr = document.createElement('tr');
    const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.valor);
    
    let statusCor = 'var(--text-muted)';
    if (f.status === 'Aberta') statusCor = 'var(--info-color)';
    if (f.status === 'Fechada') statusCor = 'var(--warning-color)';
    if (f.status === 'Paga') statusCor = 'var(--success-color)';
    
    tr.innerHTML = `
      <td><strong>${new Date(f.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</strong></td>
      <td>${f.referencia}</td>
      <td style="color: var(--error-color)">${valor}</td>
      <td style="color: ${statusCor}; font-weight: 500;">${f.status}</td>
      <td style="text-align: center;">
        <button class="btn btn-outline" data-action="ver-itens-fatura" data-id="${f.id}" style="padding: 0.25rem 0.5rem; min-height: auto;" title="Revisar Lançamentos (OCR)">🔍 Itens</button>
      </td>
    `;
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
}
