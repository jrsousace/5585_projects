document.addEventListener('routeChanged', (event) => {
  if (event.detail.path === '/config/dependentes') initOrganizationView();
});

function canManageOrganization() {
  return appState.user?.organizationRole === 'owner' ||
    (appState.user?.accessLevel === 'manager' &&
      appState.user?.subscription?.active === true);
}

async function initOrganizationView() {
  const form = document.getElementById('organization-invite-form');
  const table = document.getElementById('lista-dependentes');
  const invitationTable = document.getElementById('lista-convites-pendentes');
  const message = document.getElementById('organization-invite-message');
  const inviteLink = document.getElementById('organization-invite-link');
  const audit = document.getElementById('organization-audit-history');
  if (!form || !table || !invitationTable || !message || !inviteLink || !audit) return;

  if (!canManageOrganization()) {
    form.hidden = true;
    table.replaceChildren(messageRow(table, 'Somente o titular ou um gestor de assinatura vigente pode administrar membros.'));
    invitationTable.replaceChildren(messageRow(invitationTable, 'Somente o titular ou um gestor de assinatura vigente pode administrar convites.'));
    audit.textContent = 'Acesso restrito ao titular e aos gestores.';
    return;
  }
  const isOwner = appState.user.organizationRole === 'owner';
  const managerOption = form.elements.accessLevel.querySelector('option[value="manager"]');
  if (!isOwner && managerOption) managerOption.disabled = true;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    inviteLink.hidden = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await appState.fetchAuth('/organization/invitations', {
        method: 'POST',
        body: JSON.stringify({
          nome: form.elements.nome.value.trim(),
          email: form.elements.email.value.trim(),
          accessLevel: form.elements.accessLevel.value
        })
      });
      const link = document.createElement('a');
      link.href = result.invitationUrl;
      link.textContent = result.invitationUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'btn btn-outline';
      copyButton.textContent = 'Copiar link';
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(result.invitationUrl);
          message.textContent = 'Link copiado. Compartilhe por um canal seguro; ele expira em 72 horas.';
        } catch (error) {
          console.error('Não foi possível copiar o convite:', error);
          message.textContent = 'Não foi possível copiar automaticamente. Selecione e copie o link acima.';
        }
      });
      inviteLink.replaceChildren(link, document.createTextNode(' '), copyButton);
      inviteLink.hidden = false;
      message.textContent = 'Convite registrado no histórico. O link é de uso único e expira em 72 horas.';
      form.reset();
      await reloadOrganizationTables(table, invitationTable, audit);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  table.addEventListener('change', async (event) => {
    const select = event.target.closest('select[data-member-id]');
    if (!select) return;
    const memberId = select.dataset.memberId;
    select.disabled = true;
    try {
      await appState.fetchAuth(`/organization/members/${encodeURIComponent(memberId)}/access-level`, {
        method: 'PUT',
        body: JSON.stringify({ accessLevel: select.value })
      });
      message.textContent = 'Nível de acesso alterado e registrado no histórico.';
      await reloadOrganizationTables(table, invitationTable, audit);
    } catch (error) {
      message.textContent = error.message;
      await loadOrganizationMembers(table);
    }
  });

  const handleManagementAction = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const memberId = button.dataset.memberId;
    const invitationId = button.dataset.invitationId;
    try {
      if (button.dataset.action === 'toggle-member') {
        const active = button.dataset.active === 'true';
        if (!window.confirm(`Deseja ${active ? 'desativar' : 'reativar'} o acesso deste membro?`)) return;
        await appState.fetchAuth(`/organization/members/${encodeURIComponent(memberId)}/status`, {
          method: 'PUT',
          body: JSON.stringify({ active: !active })
        });
        message.textContent = `Acesso do membro ${active ? 'desativado' : 'reativado'} e registrado no histórico.`;
      } else if (button.dataset.action === 'revoke-invitation') {
        if (!window.confirm('Deseja cancelar este convite?')) return;
        await appState.fetchAuth(`/organization/invitations/${encodeURIComponent(invitationId)}`, {
          method: 'DELETE'
        });
        message.textContent = 'Convite cancelado e registrado no histórico.';
      }
      await reloadOrganizationTables(table, invitationTable, audit);
    } catch (error) {
      message.textContent = error.message;
    }
  };
  table.addEventListener('click', handleManagementAction);
  invitationTable.addEventListener('click', handleManagementAction);
  await reloadOrganizationTables(table, invitationTable, audit);
}

async function reloadOrganizationTables(members, invitations, audit) {
  await Promise.all([
    loadOrganizationMembers(members),
    loadPendingInvitations(invitations),
    loadOrganizationAudit(audit)
  ]);
}

async function loadOrganizationMembers(table) {
  try {
    const members = await appState.fetchAuth('/organization/members');
    table.replaceChildren();
    if (members.length === 0) {
      table.appendChild(messageRow(table, 'Nenhum membro cadastrado.'));
      return;
    }
    const actorIsOwner = appState.user.organizationRole === 'owner';
    for (const member of members) {
      const row = table.insertRow();
      row.insertCell().textContent = member.nome;
      row.insertCell().textContent = member.email;
      const accessCell = row.insertCell();
      accessCell.textContent =
        `${accessLevelLabel(member.access_level)} · ${member.email_verified ? 'e-mail confirmado' : 'e-mail pendente'}`;
      const actions = row.insertCell();
      if (member.organization_role === 'owner') {
        actions.textContent = 'Titular';
        continue;
      }
      const active = member.deleted_at === null && member.status_conta === 'ativo';
      const level = document.createElement('select');
      level.setAttribute('aria-label', `Nível de acesso de ${member.nome}`);
      level.dataset.memberId = member.id_usuario;
      addOption(level, 'manager', 'Gestor');
      addOption(level, 'user', 'Usuário');
      addOption(level, 'reader', 'Leitor');
      level.value = member.access_level;
      level.disabled = !active || (!actorIsOwner && member.access_level === 'manager');
      if (!actorIsOwner) level.querySelector('option[value="manager"]').disabled = true;
      accessCell.replaceChildren(level, document.createTextNode(
        ` · ${member.email_verified ? 'e-mail confirmado' : 'e-mail pendente'}`
      ));
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn btn-outline';
      toggle.dataset.action = 'toggle-member';
      toggle.dataset.memberId = member.id_usuario;
      toggle.dataset.active = String(active);
      toggle.textContent = active ? 'Desativar' : 'Reativar';
      if (!actorIsOwner && member.access_level === 'manager') toggle.disabled = true;
      actions.appendChild(toggle);
    }
  } catch (error) {
    console.error('Erro ao carregar membros da organização:', error);
    table.replaceChildren(messageRow(table, error.message));
  }
}

async function loadPendingInvitations(table) {
  try {
    const invitations = await appState.fetchAuth('/organization/invitations');
    table.replaceChildren();
    if (!invitations.length) {
      table.appendChild(messageRow(table, 'Nenhum convite pendente.'));
      return;
    }
    invitations.forEach((invitation) => {
      const row = table.insertRow();
      row.insertCell().textContent = invitation.nome;
      row.insertCell().textContent = invitation.email;
      row.insertCell().textContent = accessLevelLabel(invitation.access_level);
      row.insertCell().textContent = new Date(invitation.timestamp_expiracao).toLocaleString('pt-BR');
      const actions = row.insertCell();
      const revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.className = 'btn btn-outline';
      revoke.dataset.action = 'revoke-invitation';
      revoke.dataset.invitationId = invitation.id_convite;
      revoke.textContent = 'Cancelar';
      actions.appendChild(revoke);
    });
  } catch (error) {
    console.error('Erro ao carregar convites pendentes:', error);
    table.replaceChildren(messageRow(table, error.message));
  }
}

async function loadOrganizationAudit(container) {
  try {
    const events = await appState.fetchAuth('/organization/audit');
    const list = document.createElement('ol');
    if (!events.length) {
      container.textContent = 'Nenhuma alteração registrada.';
      return;
    }
    for (const event of events) {
      const item = document.createElement('li');
      const time = new Date(event.timestamp_criacao).toLocaleString('pt-BR');
      item.textContent = `${time} · ${event.actor} · ${eventActionLabel(event.action)} · ${event.target_type} · ${JSON.stringify(event.previous_state)} → ${JSON.stringify(event.new_state)}`;
      list.appendChild(item);
    }
    container.replaceChildren(list);
  } catch (error) {
    container.textContent = error.message;
  }
}

function messageRow(table, message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = table.closest('#lista-convites-pendentes') ? 5 : 4;
  cell.className = 'text-center text-muted';
  cell.textContent = message;
  row.appendChild(cell);
  return row;
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function accessLevelLabel(level) {
  return { manager: 'Gestor', user: 'Usuário', reader: 'Leitor' }[level] || 'Usuário';
}

function eventActionLabel(action) {
  return ({
    'invitation.created': 'criou convite',
    'invitation.revoked': 'cancelou convite',
    'invitation.accepted': 'convite aceito',
    'member.access_level.updated': 'alterou nível de acesso',
    'member.status.updated': 'alterou status do membro'
  })[action] || action;
}
