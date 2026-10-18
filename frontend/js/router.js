// router.js - Roteador Vanilla (Fase 2)

const router = {
  routes: {
    '/': { templateId: 'tpl-dashboard', title: 'Dashboard', module: null },
    '/orcamento': { templateId: 'tpl-orcamento', title: 'Orçamento Doméstico', module: 'budget' }
  },

  init() {
    // Escutar botão de voltar/avançar do navegador
    window.addEventListener('popstate', () => this.handleRoute());
    
    // Interceptar cliques em links de navegação
    document.body.addEventListener('click', e => {
      if (e.target.matches('[data-link]')) {
        e.preventDefault();
        this.navigateTo(e.target.getAttribute('href'));
      }
    });

    // Roteamento inicial
    this.handleRoute();
  },

  navigateTo(url) {
    history.pushState(null, null, url);
    this.handleRoute();
  },

  handleRoute() {
    const path = window.location.hash.replace('#', '') || '/';
    const route = this.routes[path] || this.routes['/'];
    
    const appContainer = document.getElementById('app');
    
    // Verificação de permissões (Fase 3)
    if (route.module && !appState.hasModuleAccess(route.module)) {
      this.renderTemplate('tpl-upsell', appContainer);
      return;
    }

    this.renderTemplate(route.templateId, appContainer);
    
    // Disparar evento para inicializar scripts específicos da página
    const event = new CustomEvent('routeChanged', { detail: { path, route } });
    document.dispatchEvent(event);
    
    // Atualizar links ativos
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-item[href="#${path}"]`);
    if (activeLink) activeLink.classList.add('active');
  },

  renderTemplate(templateId, container) {
    const template = document.getElementById(templateId);
    if (!template) {
      container.innerHTML = '<h2>Página não encontrada</h2>';
      return;
    }
    
    container.innerHTML = '';
    const clone = template.content.cloneNode(true);
    container.appendChild(clone);
  }
};
