// tools.js - Módulo de Simuladores Financeiros

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/tools/juros') {
    initJuros();
  } else if (path === '/tools/independencia') {
    initFire();
  } else if (path === '/tools/amortizacao') {
    initAmortizacao();
  }
});

let jurosChartInstance = null;

function initJuros() {
  const form = document.getElementById('form-juros');
  if(!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calcularJuros();
  });

  // Cálculo inicial
  calcularJuros();
}

function calcularJuros() {
  const P = parseFloat(document.getElementById('j-inicial').value);
  const PMT = parseFloat(document.getElementById('j-mensal').value);
  const rAno = parseFloat(document.getElementById('j-taxa').value) / 100;
  const tAnos = parseFloat(document.getElementById('j-anos').value);

  // Conversão de taxa anual para mensal
  const rMes = Math.pow(1 + rAno, 1/12) - 1;
  const nMeses = tAnos * 12;

  let montante = P;
  let investido = P;
  
  const labels = [];
  const dataMontante = [];
  const dataInvestido = [];

  for(let m = 0; m <= nMeses; m++) {
    if (m % 12 === 0 || m === nMeses) { // Gravar ponto no gráfico por ano
      labels.push(`Ano ${m/12}`);
      dataMontante.push(montante);
      dataInvestido.push(investido);
    }
    
    // Rende os juros sobre o montante atual
    montante = montante * (1 + rMes);
    // Adiciona o aporte no fim do mês
    montante += PMT;
    investido += PMT;
  }
  
  // Como o loop adicionou um aporte a mais após o último mês para calcular, revertemos 1 passo de aporte para os totais exatos
  montante -= PMT;
  investido -= PMT;

  const totalJuros = montante - investido;

  document.getElementById('j-resultado-total').textContent = montante.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'});
  document.getElementById('j-resultado-investido').textContent = investido.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'});
  document.getElementById('j-resultado-juros').textContent = totalJuros.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'});

  // Atualizar Gráfico
  const ctx = document.getElementById('jurosChart');
  if(jurosChartInstance) jurosChartInstance.destroy();
  
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();

  jurosChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total Investido',
          data: dataInvestido,
          borderColor: '#64748B',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.1
        },
        {
          label: 'Montante Final (com Juros)',
          data: dataMontante,
          borderColor: '#16845B',
          backgroundColor: 'rgba(22, 132, 91, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } }
      },
      scales: {
        x: { ticks: { color: textColor } },
        y: { ticks: { color: textColor } }
      }
    }
  });
}

function initFire() {
  const form = document.getElementById('form-fire');
  if(!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calcularFire();
  });
}

function calcularFire() {
  const custo = parseFloat(document.getElementById('f-custo').value);
  const atual = parseFloat(document.getElementById('f-atual').value);
  const aporte = parseFloat(document.getElementById('f-aporte').value);
  const rentabilidade = parseFloat(document.getElementById('f-rent').value) / 100;

  // Regra dos 4%
  const patrimonioAlvo = (custo * 12) / 0.04;
  document.getElementById('f-alvo-resultado').textContent = patrimonioAlvo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  const rMes = Math.pow(1 + rentabilidade, 1/12) - 1;
  let montante = atual;
  let meses = 0;

  // Proteção contra loop infinito se juros + aporte for <= 0
  if (aporte <= 0 && (montante * rMes) <= 0) {
    document.getElementById('f-anos-resultado').textContent = "Nunca";
    return;
  }

  while (montante < patrimonioAlvo && meses < (100 * 12)) {
    montante = montante * (1 + rMes) + aporte;
    meses++;
  }

  const anos = (meses / 12).toFixed(1);
  document.getElementById('f-anos-resultado').textContent = `${anos} anos`;
}

function initAmortizacao() {
  const form = document.getElementById('form-amort');
  if(!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calcularAmortizacao();
  });
}

function calcularAmortizacao() {
  const valor = parseFloat(document.getElementById('am-valor').value);
  const taxaAno = parseFloat(document.getElementById('am-taxa').value) / 100;
  const n = parseInt(document.getElementById('am-meses').value);
  const sistema = document.getElementById('am-sistema').value;

  const taxaMes = Math.pow(1 + taxaAno, 1/12) - 1;
  const tbody = document.getElementById('lista-amort');
  tbody.innerHTML = '';

  let saldo = valor;
  let totalPago = 0;
  let totalJuros = 0;

  const fragment = document.createDocumentFragment();

  if (sistema === 'SAC') {
    const amortizacaoConstante = valor / n;
    for (let i = 1; i <= n; i++) {
      const juros = saldo * taxaMes;
      const parcela = amortizacaoConstante + juros;
      saldo -= amortizacaoConstante;
      
      totalPago += parcela;
      totalJuros += juros;

      if (i <= 12 || i === n) { // Mostrar os primeiros 12 meses e o último para não travar navegador
        adicionarLinhaAmortizacao(fragment, i, parcela, amortizacaoConstante, juros, saldo);
      } else if (i === 13) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" class="text-center text-muted">... Linhas Omitidas para Performance ...</td>`;
        fragment.appendChild(tr);
      }
    }
  } else if (sistema === 'PRICE') {
    const parcelaConstante = valor * (Math.pow(1 + taxaMes, n) * taxaMes) / (Math.pow(1 + taxaMes, n) - 1);
    for (let i = 1; i <= n; i++) {
      const juros = saldo * taxaMes;
      const amortizacao = parcelaConstante - juros;
      saldo -= amortizacao;

      totalPago += parcelaConstante;
      totalJuros += juros;

      if (i <= 12 || i === n) {
        adicionarLinhaAmortizacao(fragment, i, parcelaConstante, amortizacao, juros, saldo);
      } else if (i === 13) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" class="text-center text-muted">... Linhas Omitidas para Performance ...</td>`;
        fragment.appendChild(tr);
      }
    }
  }

  tbody.appendChild(fragment);

  document.getElementById('am-total').textContent = totalPago.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'});
  document.getElementById('am-juros').textContent = totalJuros.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'});
}

function adicionarLinhaAmortizacao(fragment, mes, parcela, amortizacao, juros, saldo) {
  const tr = document.createElement('tr');
  const fM = (val) => Math.max(0, val).toLocaleString('pt-BR', {style: 'currency', currency:'BRL'});
  tr.innerHTML = `
    <td>${mes}</td>
    <td><strong>${fM(parcela)}</strong></td>
    <td class="text-muted">${fM(amortizacao)}</td>
    <td style="color: var(--error-color);">${fM(juros)}</td>
    <td>${fM(saldo)}</td>
  `;
  fragment.appendChild(tr);
}
