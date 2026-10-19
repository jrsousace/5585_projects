// irpf.js - Módulo de Imposto de Renda

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/irpf/resumo' && appState.hasModuleAccess('premium')) {
    initIrpfResumo();
  } else if (path === '/irpf/apuracao' && appState.hasModuleAccess('premium')) {
    initIrpfApuracao();
  }
});

function initIrpfResumo() {
  // A lógica de busca no backend seria baseada no select do ano.
  // Como já injetamos os mocks perfeitos no HTML, esta função apenas preparará a interatividade.
  console.log("Módulo IRPF Resumo carregado.");
}

function initIrpfApuracao() {
  // Lógica para exportar DARF em PDF, etc.
  console.log("Módulo IRPF Apuração carregado.");
}
