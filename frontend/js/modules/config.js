// config.js - Módulo de configurações e Cadastros auxiliares

document.addEventListener('routeChanged', (e) => {
  const { path } = e.detail;
  
  if (path === '/config/bancos') {
    initBancosView();
  } else if (path === '/cadastros/contas') {
    initContasView();
  } else if (path === '/cadastros/categorias') {
    initGruposCategoriasView();
  } else if (path === '/cadastros/centros-custo') {
    initSimplesView('Centros de Custo', 'Centro de Custo', appState.fetchCentrosCusto.bind(appState));
  } else if (path === '/cadastros/formas-pgto') {
    initSimplesView('Formas de Pagamento', 'Forma de Pagamento', appState.fetchFormasPgto.bind(appState));
  } else if (path === '/cadastros/tipos-invest') {
    initSimplesView('Tipos de Investimento', 'Tipo de Investimento', appState.fetchTiposInvestimento.bind(appState));
  } else if (path === '/config/perfil') {
    initPerfilView();
  } else if (path === '/config/assinatura') {
    initAssinaturaView();
  }
});

// --- CADASTROS ---

async function initBancosView() {
  const bancos = await appState.fetchBancos();
  const tbody = document.getElementById('lista-bancos');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (bancos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum banco encontrado.</td></tr>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  bancos.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.compe || '-'}</strong></td>
      <td class="text-muted">${b.ispb || '-'}</td>
      <td>${b.nome_curto || '-'}</td>
      <td class="text-muted"><small>${b.nome_completo || '-'}</small></td>
    `;
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

async function initContasView() {
  const contas = await appState.fetchContas();
  const tbody = document.getElementById('lista-contas');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (contas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma conta cadastrada</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  contas.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.conta}</td>
      <td>${c.banco || '-'}</td>
      <td>${c.num_conta || '-'}</td>
      <td style="text-align: center;">
        <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; min-height: auto;" data-id="${c.id_conta}">✏️</button>
      </td>
    `;
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

async function initGruposCategoriasView() {
  try {
    const [grupos, categorias] = await Promise.all([
      appState.fetchGrupos(),
      appState.fetchCategorias()
    ]);
    
    // Grupos
    const tbGrupos = document.getElementById('lista-grupos');
    if (tbGrupos) {
      tbGrupos.innerHTML = '';
      grupos.forEach(g => {
        tbGrupos.innerHTML += `<tr><td>${g.grupo}</td><td style="text-align: right;"><button class="btn btn-outline" style="padding: 0.25rem; min-height: auto;">✏️</button></td></tr>`;
      });
      if(grupos.length === 0) tbGrupos.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Nenhum grupo</td></tr>';
    }

    // Categorias
    const tbCats = document.getElementById('lista-categorias');
    if (tbCats) {
      tbCats.innerHTML = '';
      categorias.forEach(cat => {
        tbCats.innerHTML += `<tr><td>${cat.nome_categoria}</td><td style="text-align: right;"><button class="btn btn-outline" style="padding: 0.25rem; min-height: auto;">✏️</button></td></tr>`;
      });
      if(categorias.length === 0) tbCats.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Nenhuma categoria</td></tr>';
    }
  } catch (error) {
    console.error('Erro ao buscar grupos/categorias:', error);
  }
}

async function initSimplesView(title, columnHeader, fetchFn) {
  document.getElementById('view-title-simples').textContent = title;
  document.getElementById('table-header-simples').textContent = columnHeader;
  
  const descEl = document.getElementById('view-desc-simples');
  if (title === 'Centros de Custo') {
    descEl.textContent = 'Os Centros de Custo permitem agrupar suas movimentações macro (Ex: separar sua conta "Pessoal" da conta "MEI / Empresa").';
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }
  
  // Setta atributo para o Main.js saber qual form abrir
  document.getElementById('btn-novo-simples').setAttribute('data-action', 'novo-simples');
  document.getElementById('btn-novo-simples').setAttribute('data-tipo', title);

  const tbody = document.getElementById('lista-simples');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const items = await fetchFn();
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center">Nenhum registro encontrado</td></tr>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.nome}</td>
        <td style="text-align: center;">
          <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; min-height: auto;">✏️</button>
        </td>
      `;
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  } catch(e) {
    console.error(e);
  }
}

// --- CONFIGURAÇÕES ---

function initPerfilView() {
  const nomeInput = document.getElementById('perfil-nome');
  const emailInput = document.getElementById('perfil-email');
  
  // Resgata os dados da memória centralizada no store.js (appState)
  if (nomeInput && emailInput && appState.user) {
    nomeInput.value = appState.user.name;
    emailInput.value = appState.user.email;
  }
  const passwordForm = document.getElementById('form-change-password');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('replacement-password').value;
      const confirmation = document.getElementById('replacement-password-confirm').value;
      const message = document.getElementById('change-password-message');
      if (newPassword !== confirmation) {
        message.textContent = 'As senhas não coincidem.';
        return;
      }
      const submit = passwordForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      message.textContent = '';
      try {
        const result = await appState.fetchAuth('/auth/password/change', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });
        message.textContent = result.message;
        appState.clear();
        window.setTimeout(() => window.location.assign('/login'), 1200);
      } catch (error) {
        message.textContent = error.message;
        submit.disabled = false;
      }
    });
  }
}

function initAssinaturaView() {
  const planName = document.getElementById('plan-name');
  const planModules = document.getElementById('plan-modules');
  const planStatus = document.getElementById('plan-status');
  if (planName && planModules && appState.user && appState.user.subscription) {
    const isPro = appState.user.subscription.plan === 'pro';
    
    const mode = appState.dataMode();
    planName.textContent = isPro
      ? (mode === 'cloud' ? 'PRO (nuvem ativa)' : 'PRO (somente leitura)')
      : 'Gratuito (armazenamento local)';
    planModules.textContent = isPro
      ? (appState.user.subscription.expiresAt
          ? `Módulos disponíveis; validade até ${new Date(appState.user.subscription.expiresAt).toLocaleDateString('pt-BR')}.`
          : 'Módulos disponíveis em modo somente leitura até a assinatura ser regularizada.')
      : 'Módulos disponíveis com dados salvos neste navegador.';
    planStatus.textContent = appState.user.subscription.status || 'free';
  }
}
