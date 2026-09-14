// PROTEÇÃO DE LOGIN

const usuarioLogado = localStorage.getItem('user');
const tipoUsuario = localStorage.getItem('userType') || 'gestor';
const token = localStorage.getItem('token');

if (!usuarioLogado || !token) {
  localStorage.clear();
  window.location.href = '../index.html';
}

// ==================== VALIDAR TOKEN NA INICIALIZAÇÃO ====================
async function validarSessao() {
  try {
    const response = await fetch(`${API_BASE}/auth/validar`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      localStorage.clear();
      window.location.href = '../index.html';
    }
  } catch {
    // Servidor offline: mantém sessão local, não expulsa o usuário
  }
}

// ==================== API ====================
const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// ==================== VARIÁVEIS GLOBAIS ====================
let confirmacaoPendente = null;
let users = [];
let rolesData = [];

// Devolve um <svg> apontando para o sprite definido no dashboard.html.
// Substitui os emojis que eram usados como iconografia.
function ico(nome, classe = '') {
  return `<svg class="ico ${classe}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${nome}"/></svg>`;
}

// Seções são dinâmicas: vêm de /api/secoes e podem ser criadas pelo admin.
let secoesData = [];

// Ícones que o admin pode escolher — precisam existir no sprite do dashboard.html
const ICONES_SECAO = [
  'chart', 'car', 'money', 'box', 'users', 'calendar', 'target',
  'wrench', 'truck', 'building', 'pie', 'clipboard', 'trend', 'grid'
];

function getSecao(slug) {
  return secoesData.find(sec => sec.slug === slug);
}

function getSecaoIcone(slug) {
  const sec = getSecao(slug);
  return sec ? sec.icone : 'grid';
}

function getSecaoNome(slug) {
  const sec = getSecao(slug);
  return sec ? sec.nome : slug;
}

function getSecaoCor(slug) {
  const sec = getSecao(slug);
  return sec ? sec.cor : 'var(--secao-padrao)';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Para valores inseridos dentro de onclick="fn('valor')": um apostrofo no
// valor fecha a string JS ali mesmo, ANTES do HTML ser interpretado, entao
// escapeHtml (que so cuida de & < > ") nao basta. Escapa \ e ' no nivel JS
// primeiro, depois aplica escapeHtml para o atributo HTML por fora.
function escAttr(str) {
  return escapeHtml(String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ==================== NOTIFICAÇÕES (TOAST) ====================
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;

  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3500);
}

// ==================== MODAL DE CONFIRMAÇÃO ====================
function abrirConfirmacao(titulo, mensagem, callback) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = titulo;
  document.getElementById('confirmMessage').textContent = mensagem;

  confirmacaoPendente = callback;
  modal.classList.remove('hidden');
}

function cancelarConfirmacao() {
  const modal = document.getElementById('confirmModal');
  modal.classList.add('hidden');
  confirmacaoPendente = null;
}

function executarConfirmacao() {
  if (confirmacaoPendente) {
    confirmacaoPendente();
  }
  cancelarConfirmacao();
}

// Fechar modais ao clicar fora
document.addEventListener('click', function (event) {
  const confirmModal = document.getElementById('confirmModal');
  if (event.target === confirmModal) cancelarConfirmacao();

  const editModal = document.getElementById('editUserModal');
  if (event.target === editModal) fecharEditarUsuario();
});

// ==================== HELPERS DE ROLES ====================
function getRoleLabel(slug) {
  const role = rolesData.find(r => r.slug === slug);
  return role ? `${role.icone} ${role.label}` : slug;
}

function getRoleCor(slug) {
  const role = rolesData.find(r => r.slug === slug);
  return role ? role.cor : '#607d8b';
}

function isAdminRole(slug) {
  const role = rolesData.find(r => r.slug === slug);
  return role ? role.protegido : slug === 'admin';
}

// ==================== PERMISSÕES ====================
function aplicarPermissoes() {
  const configBtn = document.querySelector('.bottom-menu a.config');

  if (tipoUsuario !== 'admin') {
    if (configBtn) configBtn.style.display = 'none';
  }

  const userBadge = document.getElementById('userBadge');
  const role = rolesData.find(r => r.slug === tipoUsuario);
  if (role) {
    userBadge.textContent = role.label;
    userBadge.style.setProperty('--role-cor', role.cor);
  } else {
    userBadge.textContent = tipoUsuario;
  }
}

// ==================== CONFIGURAÇÕES: ABAS ====================
const ABAS_CONFIG = ['secoes', 'paineis', 'usuarios', 'categorias'];

function mostrarAbaConfig(aba) {
  ABAS_CONFIG.forEach(nome => {
    document.getElementById(`aba-${nome}`)?.classList.toggle('hidden', nome !== aba);
    document.getElementById(`navtab-${nome}`)?.classList.toggle('is-active', nome === aba);
  });
}

// Formulários de criação ficam recolhidos até o admin pedir
function toggleFormulario(id) {
  const form = document.getElementById(id);
  if (!form) return;
  const vaiAbrir = form.classList.contains('hidden');
  form.classList.toggle('hidden', !vaiAbrir);
  if (vaiAbrir) form.querySelector('input, select')?.focus();
}

// Números ao lado de cada aba, para não precisar abrir para saber
function atualizarContadoresConfig() {
  const totalPaineis = Object.values(dashboardsData)
    .reduce((soma, lista) => soma + lista.length, 0);

  const contadores = {
    countSecoes: secoesData.length,
    countPaineis: totalPaineis,
    countUsuarios: users.length,
    countCategorias: rolesData.length
  };

  Object.entries(contadores).forEach(([id, valor]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  });
}

// ==================== PESQUISA ====================
function pesquisarDashboard(termo) {
  const resultados = document.getElementById('searchResults');
  const termoBusca = termo.trim().toLowerCase();

  if (!termoBusca) {
    resultados.classList.add('hidden');
    resultados.innerHTML = '';
    return;
  }

  const encontrados = [];

  Object.entries(dashboardsData).forEach(([secao, dashes]) => {
    dashes.forEach(d => {
      if (d.nome && d.nome.toLowerCase().includes(termoBusca)) {
        encontrados.push({ ...d, secao });
      }
    });
  });

  if (encontrados.length === 0) {
    resultados.innerHTML = '<div class="search-result-empty">Nenhum dashboard encontrado</div>';
  } else {
    resultados.innerHTML = encontrados.map(d =>
      `<div class="search-result-item" onclick="selecionarDashboardBusca(${d.id}, '${d.secao}')">
        ${ico(getSecaoIcone(d.secao))}
        <span>${escapeHtml(d.nome)}</span>
      </div>`
    ).join('');
  }

  resultados.classList.remove('hidden');
}

function selecionarDashboardBusca(id, secao) {
  abrirDashboardItem(id, secao);
  abrirMenuSection(secao);
  document.getElementById('searchDash').value = '';
  document.getElementById('searchResults').classList.add('hidden');
  document.getElementById('searchResults').innerHTML = '';
}

// ==================== NAVEGAÇÃO ====================
function mostrarSecao(secaoId) {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.remove('mobile-open');
  sidebar.classList.add('mobile-closed');

  document.querySelectorAll('.conteudo').forEach(secao => {
    secao.classList.add('hidden');
    secao.classList.remove('showing-iframe');
  });

  const secao = document.getElementById(secaoId);
  if (secao) {
    secao.classList.remove('hidden', 'fade-in');
    void secao.offsetWidth; // força reflow pra reiniciar a animação
    secao.classList.add('fade-in');
  }

  document.querySelectorAll('.menu a, .bottom-menu a').forEach(link => link.classList.remove('active'));
  const linkAtivo = document.querySelector(`[onclick="mostrarSecao('${secaoId}')"]`);
  if (linkAtivo) linkAtivo.classList.add('active');
}


// ==================== SIDEBAR ACCORDION ====================
// Espelha secoesData no formato usado pelo resto do código
let SECOES_INFO = [];

function atualizarSecoesInfo() {
  SECOES_INFO = secoesData.map(sec => ({
    id: sec.slug,
    nome: sec.nome,
    ico: sec.icone,
    cor: sec.cor
  }));
}

function abrirMenuSection(secao) {
  const section = document.getElementById(`menu-section-${secao}`);
  const arrow = document.getElementById(`menu-arrow-${secao}`);
  if (section && !section.classList.contains('open')) {
    section.classList.add('open');
    if (arrow) arrow.classList.add('open');
  }
}

function toggleMenuSection(secao) {
  const section = document.getElementById(`menu-section-${secao}`);
  const arrow = document.getElementById(`menu-arrow-${secao}`);
  if (!section) return;

  const isOpen = section.classList.contains('open');

  // Fecha todas
  SECOES_INFO.forEach(s => {
    document.getElementById(`menu-section-${s.id}`)?.classList.remove('open');
    document.getElementById(`menu-arrow-${s.id}`)?.classList.remove('open');
  });

  if (!isOpen) {
    section.classList.add('open');
    if (arrow) arrow.classList.add('open');
  }
}

function abrirDashboardItem(id, secao) {
  const dash = (dashboardsData[secao] || []).find(d => d.id === id);
  if (!dash) return;

  mostrarSecao(secao);
  aplicarIframe(secao, dash.iframe_url);

  // Marca sub-item ativo
  document.querySelectorAll('.menu-subitem').forEach(el => el.classList.remove('active'));
  document.getElementById(`subitem-${id}`)?.classList.add('active');

  // Marca seção ativa no header
  document.querySelectorAll('.menu-section-header').forEach(el => el.classList.remove('active'));
  document.querySelector(`#menu-section-${secao} .menu-section-header`)?.classList.add('active');
}

function renderizarSubmenus() {
  SECOES_INFO.forEach(({ id: secao }) => {
    const submenu = document.getElementById(`menu-submenu-${secao}`);
    if (!submenu) return;
    const dashes = dashboardsData[secao] || [];

    if (dashes.length === 0) {
      submenu.innerHTML = '<div class="menu-submenu-empty">Nenhum dashboard</div>';
    } else {
      submenu.innerHTML = dashes.map(d =>
        `<a class="menu-subitem" id="subitem-${d.id}" onclick="abrirDashboardItem(${d.id}, '${secao}')">
          <span class="menu-subitem-dot"></span>${escapeHtml(d.nome)}
        </a>`
      ).join('');
    }
  });
}

// ==================== MENU MOBILE ====================
function toggleMobileMenu() {
  let mobileMenu = document.getElementById('mobile-menu-overlay');

  if (mobileMenu) {
    document.body.removeChild(mobileMenu);
    return;
  }

  mobileMenu = document.createElement('div');
  mobileMenu.id = 'mobile-menu-overlay';
  mobileMenu.innerHTML = `
    <div id="mobile-menu-panel">
      <div class="mobile-menu-header">
        <span>Car Station</span>
        <button onclick="toggleMobileMenu()" aria-label="Fechar menu">${ico('close')}</button>
      </div>
      <nav class="mobile-menu-nav">
        <a onclick="toggleMobileMenu(); mostrarSecao('inicio')">${ico('home')} Início</a>
        ${SECOES_INFO.map(({ id, nome, ico: icone }) => {
          // No desktop, escolher um painel é seção -> submenu -> item (dois cliques).
          // Aqui os painéis já vêm abertos dentro do próprio grupo: tocar na seção,
          // sem depois poder escolher um painel específico, levava a uma tela vazia.
          const dashes = dashboardsData[id] || [];
          const itens = dashes.length
            ? dashes.map(d => `
                <a class="mobile-menu-subitem" onclick="toggleMobileMenu(); abrirDashboardItem(${d.id}, '${id}')">
                  ${escapeHtml(d.nome)}
                </a>`).join('')
            : '<span class="mobile-menu-subitem-empty">Nenhum dashboard</span>';
          return `
            <div class="mobile-menu-group">
              <span class="mobile-menu-group-title">${ico(icone)} ${escapeHtml(nome)}</span>
              ${itens}
            </div>`;
        }).join('')}
      </nav>
      <div class="mobile-menu-bottom">
        <a onclick="toggleMobileMenu(); mostrarSecao('configuracoes')">${ico('settings')} Configurações</a>
        <button onclick="confirmarSair()">${ico('logout')} Sair</button>
      </div>
    </div>
    <div id="mobile-menu-backdrop" onclick="toggleMobileMenu()"></div>
  `;

  Object.assign(mobileMenu.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '99999',
    display: 'flex',
  });

  const panel = mobileMenu.querySelector('#mobile-menu-panel');
  Object.assign(panel.style, {
    width: '75vw',
    maxWidth: '280px',
    height: '100%',
    background: 'var(--surface-1)',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    overflowY: 'auto',
    zIndex: '2',
    position: 'relative',
  });

  const backdrop = mobileMenu.querySelector('#mobile-menu-backdrop');
  Object.assign(backdrop.style, {
    flex: '1',
    background: 'rgba(0,0,0,0.6)',
  });

  document.body.appendChild(mobileMenu);
}

// ==================== CADASTRO DE USUÁRIO ====================
function validarNovoUsuario(usuario, senha) {
  if (!usuario.trim() || !senha.trim()) {
    showNotification('Preencha todos os campos', 'error');
    return false;
  }

  if (usuario.trim().length < 3) {
    showNotification('Usuário deve ter no mínimo 3 caracteres', 'error');
    return false;
  }

  if (senha.length < 3) {
    showNotification('Senha deve ter no mínimo 3 caracteres', 'error');
    return false;
  }

  return true;
}

async function cadastrarUsuario() {
  const usuario = document.getElementById('novoUsuario').value.trim();
  const email = document.getElementById('novoEmail').value.trim();
  const senha = document.getElementById('novaSenha').value;
  const tipo = document.getElementById('tipoUsuario').value;

  if (!validarNovoUsuario(usuario, senha)) {
    return;
  }

  if (!email) {
    showNotification('Informe o email do usuário', 'error');
    return;
  }

  const btn = document.querySelector('#usuario-add-form .btn-save-dash');
  btn.disabled = true;
  btn.textContent = 'Cadastrando...';

  try {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: usuario, email, password: senha, tipo })
    });

    const data = await response.json();

    if (data.sucesso) {
      document.getElementById('novoUsuario').value = '';
      document.getElementById('novoEmail').value = '';
      document.getElementById('novaSenha').value = '';
      document.getElementById('tipoUsuario').value = 'gestor';

      toggleFormulario('usuario-add-form');
      showNotification(`Usuário "${usuario}" cadastrado com sucesso!`, 'success');
      await listarUsuarios();
    } else {
      showNotification(data.mensagem || 'Erro ao cadastrar usuário', 'error');
    }
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cadastrar usuário';
  }
}

// ==================== LISTAR USUÁRIOS ====================
async function listarUsuarios() {
  const container = document.getElementById('usersList');
  if (!container) return;

  container.innerHTML = '<p style="color:#999; text-align:center;">Carregando...</p>';

  try {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '../index.html';
      return;
    }

    const data = await response.json();

    if (!data.sucesso) {
      container.innerHTML = '<p style="color:#e74c3c; text-align:center;">Erro ao carregar usuários</p>';
      return;
    }

    users = data.usuarios;

    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-list">
          <span class="empty-list-icon">${ico('users')}</span>
          <p>Nenhum usuário cadastrado</p>
        </div>
      `;
      return;
    }

    container.innerHTML = users.map(u => {
      const podeRemover = u.username !== usuarioLogado;
      const ultimoLogin = u.ultimo_login
        ? new Date(u.ultimo_login).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : 'Nunca acessou';
      return `
        <div class="user-item">
          <div class="user-item-info">
            <div class="user-item-main">
              <span class="user-item-name">
                <span class="user-item-avatar">${escapeHtml((u.username || '?').charAt(0).toUpperCase())}</span>
                ${escapeHtml(u.username)}
              </span>
              <span class="user-item-type" style="--role-cor:${escapeHtml(getRoleCor(u.tipo))}">
                ${escapeHtml(getRoleLabel(u.tipo))}
              </span>
            </div>
            <span class="user-item-login">${u.email ? escapeHtml(u.email) + ' · ' : ''}Último acesso: ${ultimoLogin}</span>
          </div>
          <div class="user-item-actions">
            <button class="btn-edit" onclick="abrirEditarUsuario(${u.id}, '${escAttr(u.username)}', '${escAttr(u.tipo)}')">
              ${ico('edit')} Editar
            </button>
            ${podeRemover ? `
              <button class="btn-delete" onclick="confirmarRemoverUsuario(${u.id}, '${escAttr(u.username)}')">
                ${ico('trash')} Remover
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    atualizarContadoresConfig();

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    container.innerHTML = '<p style="color:#e74c3c; text-align:center;">Erro de conexão com o servidor</p>';
  }
}

// ==================== EDITAR USUÁRIO ====================
let editandoUsuarioId = null;

async function abrirEditarUsuario(id, username, tipo) {
  editandoUsuarioId = id;
  document.getElementById('editUserName').textContent = `${username}`;
  document.getElementById('editUserUsername').value = username;
  document.getElementById('editUserPassword').value = '';
  document.getElementById('editUserTipo').value = tipo;
  document.getElementById('editUserTipo').disabled = (username === usuarioLogado);

  // Permissões: só mostra pra gestores
  const permissoesGroup = document.getElementById('permissoesGroup');
  const checklist = document.getElementById('permissoesChecklist');

  if (!isAdminRole(tipo)) {
    permissoesGroup.classList.remove('hidden');
    checklist.innerHTML = '<p style="font-size:12px;color:#999;">Carregando...</p>';

    try {
      const [resDashes, resPerms] = await Promise.all([
        fetch(`${API_BASE}/dashboards`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/users/${id}/permissoes`, { headers: getAuthHeaders() })
      ]);

      const dataDashes = await resDashes.json();
      const dataPerms = await resPerms.json();

      const todosOsDashes = dataDashes.sucesso ? dataDashes.dashboards.filter(d => d.iframe_url) : [];
      const permitidos = dataPerms.sucesso ? dataPerms.permissoes : [];

      if (todosOsDashes.length === 0) {
        checklist.innerHTML = '<p style="font-size:12px;color:#999;font-style:italic;">Nenhum dashboard cadastrado ainda</p>';
      } else {
        checklist.innerHTML = todosOsDashes.map(d => `
          <label class="permissao-item">
            <input type="checkbox" value="${d.id}" ${permitidos.includes(d.id) ? 'checked' : ''}>
            <span>${ico(getSecaoIcone(d.secao))} ${escapeHtml(d.nome)}</span>
          </label>
        `).join('');
      }
    } catch {
      checklist.innerHTML = '<p style="font-size:12px;color:#e74c3c;">Erro ao carregar dashboards</p>';
    }
  } else {
    permissoesGroup.classList.add('hidden');
  }

  document.getElementById('editUserModal').classList.remove('hidden');
  document.getElementById('editUserUsername').focus();
}

function fecharEditarUsuario() {
  editandoUsuarioId = null;
  document.getElementById('editUserModal').classList.add('hidden');
}

async function salvarEdicaoUsuario() {
  if (!editandoUsuarioId) return;

  const username = document.getElementById('editUserUsername').value.trim();
  const password = document.getElementById('editUserPassword').value;
  const tipo = document.getElementById('editUserTipo').value;

  if (username && username.length < 3) {
    showNotification('Usuário deve ter no mínimo 3 caracteres', 'error');
    return;
  }

  const btn = document.getElementById('editUserBtn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const body = { tipo };
    if (username) body.username = username;
    if (password) body.password = password;

    const response = await fetch(`${API_BASE}/users/${editandoUsuarioId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.sucesso) {
      // Salvar permissões se for gestor
      const permissoesGroup = document.getElementById('permissoesGroup');
      if (!permissoesGroup.classList.contains('hidden')) {
        const checkboxes = document.querySelectorAll('#permissoesChecklist input[type="checkbox"]');
        const dashboard_ids = Array.from(checkboxes).filter(c => c.checked).map(c => parseInt(c.value));
        await fetch(`${API_BASE}/users/${editandoUsuarioId}/permissoes`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ dashboard_ids })
        });
      }

      fecharEditarUsuario();
      showNotification('Usuário atualizado com sucesso!', 'success');
      await listarUsuarios();
    } else {
      showNotification(data.mensagem || 'Erro ao salvar', 'error');
    }
  } catch (error) {
    console.error('Erro ao editar usuário:', error);
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

// ==================== REMOVER USUÁRIO ====================
function confirmarRemoverUsuario(id, username) {
  abrirConfirmacao(
    'Remover usuário',
    `Tem certeza que deseja remover "${username}"? Esta ação não pode ser desfeita.`,
    () => removerUsuario(id, username)
  );
}

async function removerUsuario(id, username) {
  try {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (data.sucesso) {
      showNotification(`Usuário "${username}" removido com sucesso`, 'success');
      await listarUsuarios();
    } else {
      showNotification(data.mensagem || 'Erro ao remover usuário', 'error');
    }
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    showNotification('Erro de conexão com o servidor', 'error');
  }
}

// ==================== CATEGORIAS (ROLES) ====================
function popularSelectsTipo(tipoSelecionado) {
  ['tipoUsuario', 'editUserTipo'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const valorAtual = tipoSelecionado || select.value;
    select.innerHTML = rolesData.map(r =>
      `<option value="${escapeHtml(r.slug)}" ${r.slug === valorAtual ? 'selected' : ''}>${escapeHtml(r.icone)} ${escapeHtml(r.label)}</option>`
    ).join('');
  });
}

function atualizarPermissoesVisibilidade(tipo) {
  const permissoesGroup = document.getElementById('permissoesGroup');
  if (!permissoesGroup) return;
  if (isAdminRole(tipo)) {
    permissoesGroup.classList.add('hidden');
  } else {
    permissoesGroup.classList.remove('hidden');
  }
}

async function carregarRoles() {
  try {
    const response = await fetch(`${API_BASE}/roles`, { headers: getAuthHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.sucesso) return;
    rolesData = data.roles;
    popularSelectsTipo();
    aplicarPermissoes();
    if (tipoUsuario === 'admin') renderizarConfigRoles();
    atualizarContadoresConfig();
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
  }
}

function renderizarConfigRoles() {
  const container = document.getElementById('rolesConfigContent');
  if (!container) return;

  if (rolesData.length === 0) {
    container.innerHTML = '<p class="dash-list-empty">Nenhuma categoria cadastrada</p>';
    return;
  }

  container.innerHTML = rolesData.map(r => `
    <div class="dash-list-item" id="role-item-${r.id}">
      <div class="dash-list-item-info">
        <span class="dash-list-item-nome">
          <span class="role-cor-swatch" style="background:${escapeHtml(r.cor)}"></span>
          ${escapeHtml(r.icone)} ${escapeHtml(r.label)}
          ${r.protegido ? '<span class="role-protegido-tag">protegida</span>' : ''}
        </span>
        <span class="dash-list-item-status" style="color:#999;font-size:11px;">${escapeHtml(r.slug)}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-edit-dash" onclick="abrirEditarRole(${r.id}, '${escAttr(r.label)}', '${escAttr(r.icone)}', '${escAttr(r.cor)}')">Editar</button>
        ${!r.protegido ? `<button class="btn-remove-dash" onclick="confirmarDeletarRole(${r.id}, '${escAttr(r.label)}')">Remover</button>` : ''}
      </div>
    </div>
    <div class="dash-add-form hidden" id="role-edit-form-${r.id}">
      <div class="role-add-row">
        <input type="text" id="role-edit-label-${r.id}" class="dash-input" placeholder="Nome de exibição" maxlength="50">
        <input type="text" id="role-edit-icone-${r.id}" class="dash-input role-icone-input" placeholder="Ícone" maxlength="5">
      </div>
      <div class="role-cor-group">
        <label>Cor do badge</label>
        <input type="color" id="role-edit-cor-${r.id}" value="${escapeHtml(r.cor)}">
      </div>
      <div class="dash-add-actions">
        <button class="btn-save-dash" onclick="salvarEdicaoRole(${r.id})">Salvar</button>
        <button class="btn-cancel-dash" onclick="fecharEditarRole(${r.id})">Cancelar</button>
      </div>
    </div>
  `).join('');
}

function abrirEditarRole(id, label, icone, cor) {
  document.querySelectorAll('[id^="role-edit-form-"]').forEach(f => f.classList.add('hidden'));
  const form = document.getElementById(`role-edit-form-${id}`);
  if (!form) return;
  document.getElementById(`role-edit-label-${id}`).value = label;
  document.getElementById(`role-edit-icone-${id}`).value = icone;
  document.getElementById(`role-edit-cor-${id}`).value = cor;
  form.classList.remove('hidden');
  document.getElementById(`role-edit-label-${id}`).focus();
}

function fecharEditarRole(id) {
  document.getElementById(`role-edit-form-${id}`)?.classList.add('hidden');
}

async function salvarEdicaoRole(id) {
  const label = document.getElementById(`role-edit-label-${id}`)?.value.trim();
  const icone = document.getElementById(`role-edit-icone-${id}`)?.value.trim();
  const cor = document.getElementById(`role-edit-cor-${id}`)?.value;

  if (!label) {
    showNotification('Informe o nome da categoria', 'error');
    return;
  }

  const btn = document.querySelector(`#role-edit-form-${id} .btn-save-dash`);
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const response = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ label, icone: icone || '👤', cor })
    });
    const data = await response.json();
    if (data.sucesso) {
      showNotification('Categoria atualizada!', 'success');
      await carregarRoles();
    } else {
      showNotification(data.mensagem || 'Erro ao atualizar', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

async function criarRole() {
  const slug = document.getElementById('role-add-slug')?.value.trim();
  const label = document.getElementById('role-add-label')?.value.trim();
  const icone = document.getElementById('role-add-icone')?.value.trim();
  const cor = document.getElementById('role-add-cor')?.value;

  if (!slug || !label) {
    showNotification('Preencha o identificador e o nome da categoria', 'error');
    return;
  }

  const btn = document.querySelector('#role-add-form .btn-save-dash');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const response = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ slug, label, icone: icone || '👤', cor })
    });
    const data = await response.json();
    if (data.sucesso) {
      document.getElementById('role-add-slug').value = '';
      document.getElementById('role-add-label').value = '';
      document.getElementById('role-add-icone').value = '';
      document.getElementById('role-add-cor').value = '#607d8b';
      toggleFormulario('role-add-form');
      showNotification(`Categoria "${label}" criada!`, 'success');
      await carregarRoles();
    } else {
      showNotification(data.mensagem || 'Erro ao criar categoria', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar Categoria';
  }
}

function confirmarDeletarRole(id, label) {
  abrirConfirmacao(
    'Remover categoria',
    `Tem certeza que deseja remover a categoria "${label}"? Isso só é possível se não houver usuários nessa categoria.`,
    () => deletarRole(id, label)
  );
}

async function deletarRole(id, label) {
  try {
    const response = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (data.sucesso) {
      showNotification(`Categoria "${label}" removida`, 'info');
      await carregarRoles();
    } else {
      showNotification(data.mensagem || 'Erro ao remover', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  }
}

// ==================== DASHBOARDS POWER BI ====================
let dashboardsData = {};

// ==================== CONFIG: SEÇÕES (ADMIN) ====================

// Paleta de ícones clicável, reaproveitando o sprite da página
function seletorIcones(prefixo, selecionado) {
  return `
    <div class="icone-picker" id="${prefixo}-picker">
      ${ICONES_SECAO.map(nome => `
        <button type="button"
          class="icone-opcao ${nome === selecionado ? 'is-selected' : ''}"
          data-icone="${nome}"
          onclick="selecionarIcone('${prefixo}', '${nome}')"
          title="${nome}" aria-label="Ícone ${nome}">
          ${ico(nome)}
        </button>`).join('')}
    </div>
    <input type="hidden" id="${prefixo}-icone" value="${selecionado}">`;
}

function selecionarIcone(prefixo, nome) {
  const campo = document.getElementById(`${prefixo}-icone`);
  if (campo) campo.value = nome;

  const picker = document.getElementById(`${prefixo}-picker`);
  if (!picker) return;
  picker.querySelectorAll('.icone-opcao').forEach(btn => {
    btn.classList.toggle('is-selected', btn.dataset.icone === nome);
  });
}

function renderizarConfigSecoes() {
  const container = document.getElementById('secoesConfigContent');
  if (!container) return;

  if (secoesData.length === 0) {
    container.innerHTML = '<p class="dash-list-empty">Nenhuma seção cadastrada</p>';
    return;
  }

  container.innerHTML = secoesData.map(sec => {
    const qtd = (dashboardsData[sec.slug] || []).length;
    return `
    <div class="dash-list-item" id="secao-item-${sec.id}" style="--secao:${escapeHtml(sec.cor)}">
      <div class="dash-list-item-info">
        <span class="dash-list-item-nome">
          <span class="secao-chip">${ico(sec.icone)}</span>
          ${escapeHtml(sec.nome)}
        </span>
        <span class="dash-list-item-status">
          ${escapeHtml(sec.slug)} · ${qtd} ${qtd === 1 ? 'painel' : 'painéis'}
        </span>
      </div>
      <div class="dash-list-item-actions">
        <button class="btn-edit-dash" onclick="abrirEditarSecao(${sec.id})">${ico('edit')} Editar</button>
        <button class="btn-remove-dash" onclick="confirmarDeletarSecao(${sec.id})">${ico('trash')} Remover</button>
      </div>
    </div>
    <div class="dash-add-form hidden" id="secao-edit-form-${sec.id}">
      <input type="text" id="secao-edit-nome-${sec.id}" class="dash-input"
             placeholder="Nome de exibição" maxlength="50" value="${escapeHtml(sec.nome)}">
      <div class="campo-icone">
        <label>Ícone</label>
        ${seletorIcones(`secao-edit-${sec.id}`, sec.icone)}
      </div>
      <div class="role-cor-group">
        <label for="secao-edit-cor-${sec.id}">Cor da seção</label>
        <input type="color" id="secao-edit-cor-${sec.id}" value="${escapeHtml(sec.cor)}">
      </div>
      <div class="dash-add-actions">
        <button class="btn-save-dash" onclick="salvarEdicaoSecao(${sec.id})">Salvar</button>
        <button class="btn-cancel-dash" onclick="fecharEditarSecao(${sec.id})">Cancelar</button>
      </div>
    </div>`;
  }).join('');

  // O formulário de criação também precisa do seletor de ícones
  const addPicker = document.getElementById('secaoAddIconeWrap');
  if (addPicker && !addPicker.dataset.pronto) {
    addPicker.innerHTML = seletorIcones('secao-add', 'chart');
    addPicker.dataset.pronto = '1';
  }
}

function abrirEditarSecao(id) {
  secoesData.forEach(sec => {
    document.getElementById(`secao-edit-form-${sec.id}`)?.classList.add('hidden');
  });
  document.getElementById(`secao-edit-form-${id}`)?.classList.remove('hidden');
  document.getElementById(`secao-edit-nome-${id}`)?.focus();
}

function fecharEditarSecao(id) {
  document.getElementById(`secao-edit-form-${id}`)?.classList.add('hidden');
}

async function criarSecao() {
  const slug = document.getElementById('secao-add-slug')?.value.trim();
  const nome = document.getElementById('secao-add-nome')?.value.trim();
  const icone = document.getElementById('secao-add-icone')?.value || 'grid';
  const cor = document.getElementById('secao-add-cor')?.value;

  if (!slug || !nome) {
    showNotification('Preencha o identificador e o nome da seção', 'error');
    return;
  }

  const btn = document.querySelector('#secao-add-form .btn-save-dash');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const response = await fetch(`${API_BASE}/secoes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ slug, nome, icone, cor })
    });
    const data = await response.json();

    if (data.sucesso) {
      document.getElementById('secao-add-slug').value = '';
      document.getElementById('secao-add-nome').value = '';
      toggleFormulario('secao-add-form');
      showNotification(`Seção "${nome}" criada!`, 'success');
      await carregarSecoes();
      await carregarDashboards();
    } else {
      showNotification(data.mensagem || 'Erro ao criar seção', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar seção';
  }
}

async function salvarEdicaoSecao(id) {
  const nome = document.getElementById(`secao-edit-nome-${id}`)?.value.trim();
  const icone = document.getElementById(`secao-edit-${id}-icone`)?.value;
  const cor = document.getElementById(`secao-edit-cor-${id}`)?.value;

  if (!nome) {
    showNotification('O nome da seção não pode ficar vazio', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/secoes/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome, icone, cor })
    });
    const data = await response.json();

    if (data.sucesso) {
      showNotification('Seção atualizada!', 'success');
      fecharEditarSecao(id);
      await carregarSecoes();
      await carregarDashboards();
    } else {
      showNotification(data.mensagem || 'Erro ao atualizar seção', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  }
}

function confirmarDeletarSecao(id) {
  const secao = secoesData.find(sec => sec.id === id);
  if (!secao) return;

  const qtd = (dashboardsData[secao.slug] || []).length;
  if (qtd > 0) {
    showNotification(
      `"${secao.nome}" ainda tem ${qtd} ${qtd === 1 ? 'painel' : 'painéis'}. Remova antes de excluir a seção.`,
      'error'
    );
    return;
  }

  abrirConfirmacao(
    'Remover seção',
    `Remover a seção "${secao.nome}"? Ela sai da sidebar e da tela inicial.`,
    () => deletarSecao(id)
  );
}

async function deletarSecao(id) {
  try {
    const response = await fetch(`${API_BASE}/secoes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (data.sucesso) {
      showNotification('Seção removida', 'success');
      await carregarSecoes();
      await carregarDashboards();
    } else {
      showNotification(data.mensagem || 'Erro ao remover seção', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  }
}

function extrairUrl(input) {
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith('<iframe')) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }
  return trimmed;
}

function aplicarIframe(secao, url) {
  const container = document.getElementById(`iframe-${secao}`);
  const placeholder = document.getElementById(`placeholder-${secao}`);
  const sectionHeader = document.getElementById(`section-header-${secao}`);
  const secaoEl = document.getElementById(secao);

  if (!container) return;

  if (url) {
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.frameBorder = '0';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'fullscreen');
    container.appendChild(iframe);
    container.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');
    if (sectionHeader) sectionHeader.classList.add('hidden');
    if (secaoEl) secaoEl.classList.add('showing-iframe');
  } else {
    container.innerHTML = '';
    container.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (sectionHeader) sectionHeader.classList.remove('hidden');
    if (secaoEl) secaoEl.classList.remove('showing-iframe');
  }
}

async function carregarSecoes() {
  try {
    const response = await fetch(`${API_BASE}/secoes`, { headers: getAuthHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.sucesso) return;

    secoesData = data.secoes;
    atualizarSecoesInfo();
    renderizarMenuSecoes();
    renderizarSecoesConteudo();
    if (tipoUsuario === 'admin') renderizarConfigSecoes();
    atualizarContadoresConfig();
  } catch (error) {
    console.error('Erro ao carregar seções:', error);
  }
}

// Blocos sanfonados da sidebar, um por seção
function renderizarMenuSecoes() {
  const container = document.getElementById('menuSecoes');
  if (!container) return;

  container.innerHTML = SECOES_INFO.map(({ id, nome, ico: icone, cor }) => `
    <div class="menu-section" id="menu-section-${id}" style="--secao:${escapeHtml(cor)}">
      <div class="menu-section-header" onclick="toggleMenuSection('${id}')">
        <span class="menu-section-title">
          ${ico(icone)}${escapeHtml(nome)}
        </span>
        <svg class="ico menu-section-arrow" id="menu-arrow-${id}" viewBox="0 0 24 24"><use href="#i-chevron"/></svg>
      </div>
      <div class="menu-submenu" id="menu-submenu-${id}"></div>
    </div>
  `).join('');
}

// Uma <section> de conteúdo por seção, com iframe e placeholder próprios
function renderizarSecoesConteudo() {
  const main = document.querySelector('.main-content');
  const ancora = document.getElementById('configuracoes');
  if (!main || !ancora) return;

  main.querySelectorAll('.conteudo[data-secao]').forEach(el => el.remove());

  SECOES_INFO.forEach(({ id, nome, ico: icone }) => {
    const secao = document.createElement('section');
    secao.id = id;
    secao.className = 'conteudo hidden';
    secao.dataset.secao = id;
    secao.innerHTML = `
      <div class="section-header" id="section-header-${id}">
        <span class="section-eyebrow">${ico(icone)}${escapeHtml(nome)}</span>
        <h1>${escapeHtml(nome)}</h1>
        <p>Escolha um painel no menu lateral para visualizar.</p>
      </div>
      <div id="iframe-${id}" class="iframe-container hidden"></div>
      <div id="placeholder-${id}" class="placeholder">
        <span class="placeholder-icon">${ico(icone)}</span>
        <h2>Nenhum painel aberto</h2>
        <p>Selecione um dashboard de ${escapeHtml(nome)} no menu lateral.</p>
        <small>Se a lista estiver vazia, nenhum painel foi configurado ainda.</small>
      </div>`;
    main.insertBefore(secao, ancora);
  });
}

async function carregarDashboards() {
  try {
    const response = await fetch(`${API_BASE}/dashboards`, { headers: getAuthHeaders() });
    if (!response.ok) return;

    const data = await response.json();
    if (!data.sucesso) return;

    // Uma lista por seção cadastrada; painéis de seções removidas ficam de fora
    dashboardsData = {};
    SECOES_INFO.forEach(({ id }) => { dashboardsData[id] = []; });
    data.dashboards.forEach(d => {
      if (dashboardsData[d.secao]) dashboardsData[d.secao].push(d);
    });

    renderizarSubmenus();
    renderizarInicio();
    renderizarConfigDashboards();
    if (tipoUsuario === 'admin') renderizarConfigSecoes();
    atualizarContadoresConfig();

  } catch (error) {
    console.error('Erro ao carregar dashboards:', error);
  }
}

// ==================== TELA INICIAL ====================
function renderizarInicio() {
  const grid = document.getElementById('dashGrid');
  const resumo = document.getElementById('inicioResumo');
  if (!grid) return;

  // Achata as seções numa lista única de painéis com URL configurada
  const cards = [];
  SECOES_INFO.forEach(({ id: secao, nome, ico: iconeSecao }) => {
    (dashboardsData[secao] || [])
      .filter(d => d.iframe_url)
      .forEach(d => cards.push({ ...d, secao, secaoNome: nome, iconeSecao, cor: getSecaoCor(secao) }));
  });

  if (resumo) {
    resumo.textContent = cards.length === 0
      ? 'Nenhum painel liberado para o seu acesso ainda.'
      : 'Selecione um painel para abrir.';
  }

  // Resumo com dados reais do proprio portal - nada inventado
  const stats = document.getElementById('inicioStats');
  if (stats) {
    const secoesComPainel = SECOES_INFO.filter(
      ({ id }) => (dashboardsData[id] || []).some(d => d.iframe_url)
    ).length;
    const perfil = rolesData.find(r => r.slug === tipoUsuario);
    stats.innerHTML = `
      <div class="stat">
        <span class="stat-num">${cards.length}</span>
        <span class="stat-label">${cards.length === 1 ? 'painel' : 'painéis'}</span>
      </div>
      <div class="stat">
        <span class="stat-num">${secoesComPainel}</span>
        <span class="stat-label">${secoesComPainel === 1 ? 'seção' : 'seções'}</span>
      </div>
      <div class="stat">
        <span class="stat-num stat-num--perfil">${escapeHtml(perfil ? perfil.label : tipoUsuario)}</span>
        <span class="stat-label">seu perfil</span>
      </div>`;
  }

  if (cards.length === 0) {
    grid.innerHTML = `
      <div class="dash-grid-empty">
        <span class="empty-list-icon">${ico('grid')}</span>
        <h2>Nenhum painel por aqui</h2>
        <p>Assim que um dashboard do Power BI for liberado para o seu perfil, ele aparece nesta tela.</p>
      </div>`;
    return;
  }

  grid.innerHTML = cards.map(d => `
    <button type="button" class="dash-card" style="--secao:${escapeHtml(d.cor)}"
      onclick="abrirDashboardItem(${d.id}, '${d.secao}'); abrirMenuSection('${d.secao}')">
      <span class="dash-card-watermark">${ico(d.iconeSecao)}</span>
      <span class="dash-card-tag">${ico(d.iconeSecao)}${d.secaoNome}</span>
      <span class="dash-card-name">${escapeHtml(d.nome)}</span>
      <span class="dash-card-go">Abrir painel ${ico('arrow')}</span>
    </button>
  `).join('');
}

// ==================== CONFIG PANEL (ADMIN) ====================
function renderizarConfigDashboards() {
  const container = document.getElementById('dashConfigContent');
  if (!container || tipoUsuario !== 'admin') return;

  container.innerHTML = SECOES_INFO.map(({ id: secao, nome, ico: iconeSecao }) => {
    const dashes = dashboardsData[secao] || [];
    return `
      <div class="dash-config-section">
        <div class="dash-config-section-header">
          <span>${ico(iconeSecao)} ${nome}</span>
          <button class="btn-add-dash" onclick="toggleAddForm('${secao}')">${ico('plus')} Adicionar</button>
        </div>
        <div class="dash-list" id="dash-list-${secao}">
          ${dashes.length === 0
            ? '<p class="dash-list-empty">Nenhum dashboard configurado</p>'
            : dashes.map(d => `
              <div class="dash-list-item" id="dash-item-${d.id}">
                <div class="dash-list-item-info">
                  <span class="dash-list-item-nome">${escapeHtml(d.nome)}</span>
                  <span class="dash-list-item-status ${d.iframe_url ? 'is-ok' : 'is-warn'}">
                    ${d.iframe_url ? ico('check') + 'URL configurada' : ico('alert') + 'Sem URL'}
                  </span>
                </div>
                <div class="dash-list-item-actions">
                  <button class="btn-edit-dash" onclick="abrirEditarDash(${d.id}, '${escAttr(d.nome)}', '${escAttr(d.iframe_url || '')}', '${secao}')">Editar</button>
                  <button class="btn-remove-dash" onclick="confirmarDeletarDashboard(${d.id}, '${escAttr(d.nome)}', '${secao}')">Remover</button>
                </div>
              </div>
              <div class="dash-add-form hidden" id="dash-edit-form-${d.id}">
                <input type="text" id="dash-edit-nome-${d.id}" class="dash-input" placeholder="Nome do dashboard">
                <input type="text" id="dash-edit-url-${d.id}" class="dash-input" placeholder="Link ou código iframe do Power BI">
                <div class="dash-add-actions">
                  <button class="btn-save-dash" onclick="salvarEdicaoDash(${d.id}, '${secao}')">Salvar</button>
                  <button class="btn-cancel-dash" onclick="fecharEditarDash(${d.id})">Cancelar</button>
                </div>
              </div>`).join('')
          }
        </div>
        <div class="dash-add-form hidden" id="dash-add-form-${secao}">
          <input type="text" id="dash-add-nome-${secao}" class="dash-input" placeholder="Nome do dashboard">
          <input type="text" id="dash-add-url-${secao}" class="dash-input" placeholder="Link ou código iframe do Power BI">
          <div class="dash-add-actions">
            <button class="btn-save-dash" onclick="criarDashboard('${secao}')">Salvar</button>
            <button class="btn-cancel-dash" onclick="cancelarAddForm('${secao}')">Cancelar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function abrirEditarDash(id, nome, url, secao) {
  // Fecha qualquer edição aberta
  document.querySelectorAll('[id^="dash-edit-form-"]').forEach(f => f.classList.add('hidden'));

  const form = document.getElementById(`dash-edit-form-${id}`);
  if (!form) return;

  document.getElementById(`dash-edit-nome-${id}`).value = nome;
  document.getElementById(`dash-edit-url-${id}`).value = url;
  form.classList.remove('hidden');
  document.getElementById(`dash-edit-nome-${id}`).focus();
}

function fecharEditarDash(id) {
  document.getElementById(`dash-edit-form-${id}`)?.classList.add('hidden');
}

async function salvarEdicaoDash(id, secao) {
  const nome = document.getElementById(`dash-edit-nome-${id}`)?.value.trim();
  const urlRaw = document.getElementById(`dash-edit-url-${id}`)?.value.trim();
  const url = extrairUrl(urlRaw || '');

  if (!nome) {
    showNotification('Informe o nome do dashboard', 'error');
    return;
  }

  const btn = document.querySelector(`#dash-edit-form-${id} .btn-save-dash`);
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const response = await fetch(`${API_BASE}/dashboards/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome, iframe_url: url || null })
    });

    const data = await response.json();

    if (data.sucesso) {
      showNotification('Dashboard atualizado!', 'success');
      await carregarDashboards();
    } else {
      showNotification(data.mensagem || 'Erro ao atualizar', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

function toggleAddForm(secao) {
  const form = document.getElementById(`dash-add-form-${secao}`);
  if (!form) return;
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) {
    document.getElementById(`dash-add-nome-${secao}`)?.focus();
  }
}

function cancelarAddForm(secao) {
  const form = document.getElementById(`dash-add-form-${secao}`);
  if (form) form.classList.add('hidden');
  if (document.getElementById(`dash-add-nome-${secao}`)) document.getElementById(`dash-add-nome-${secao}`).value = '';
  if (document.getElementById(`dash-add-url-${secao}`)) document.getElementById(`dash-add-url-${secao}`).value = '';
}

async function criarDashboard(secao) {
  const nome = document.getElementById(`dash-add-nome-${secao}`)?.value.trim();
  const urlRaw = document.getElementById(`dash-add-url-${secao}`)?.value.trim();
  const url = extrairUrl(urlRaw || '');

  if (!nome) {
    showNotification('Informe o nome do dashboard', 'error');
    return;
  }

  const btn = document.querySelector(`#dash-add-form-${secao} .btn-save-dash`);
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const response = await fetch(`${API_BASE}/dashboards/${secao}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome, iframe_url: url || null })
    });

    const data = await response.json();

    if (data.sucesso) {
      showNotification(`Dashboard "${nome}" adicionado!`, 'success');
      await carregarDashboards();
      cancelarAddForm(secao);
    } else {
      showNotification(data.mensagem || 'Erro ao criar dashboard', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

function confirmarDeletarDashboard(id, nome, secao) {
  abrirConfirmacao(
    'Remover dashboard',
    `Tem certeza que deseja remover "${nome}"?`,
    () => deletarDashboard(id, secao)
  );
}

async function deletarDashboard(id, secao) {
  try {
    const response = await fetch(`${API_BASE}/dashboards/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (data.sucesso) {
      showNotification('Dashboard removido', 'info');
      await carregarDashboards();
      aplicarIframe(secao, null);
    } else {
      showNotification(data.mensagem || 'Erro ao remover', 'error');
    }
  } catch {
    showNotification('Erro de conexão com o servidor', 'error');
  }
}

// ==================== LOGOUT ====================
function confirmarSair() {
  abrirConfirmacao(
    'Fazer logout',
    'Deseja realmente sair da sua conta?',
    sair
  );
}

function sair() {
  localStorage.clear();
  window.location.href = '../index.html';
}

// ==================== INICIALIZAÇÃO ====================
window.addEventListener('DOMContentLoaded', async function () {
  await validarSessao();

  // Atualizar UI
  document.getElementById('username').textContent = usuarioLogado;
  const welcomeEl = document.getElementById('welcomeName');
  if (welcomeEl) welcomeEl.textContent = usuarioLogado;

  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) avatarEl.textContent = (usuarioLogado || '?').charAt(0).toUpperCase();

  // Aplicar permissões
  aplicarPermissoes();

  // Renderiza submenus imediatamente com dados vazios (antes da API responder)
  renderizarSubmenus();
  renderizarInicio();

  // Carregar categorias, depois seções (que montam menu e conteúdo) e então dashboards
  await carregarRoles();
  await carregarSecoes();
  await carregarDashboards();

  if (tipoUsuario === 'admin') {
    listarUsuarios();
  }

  // Mostrar seção inicial
  mostrarSecao('inicio');

  // Responsividade mobile
  const sidebar = document.querySelector('.sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.add('mobile-closed');
  }
});

// Atualizar responsividade ao redimensionar
window.addEventListener('resize', function () {
  const sidebar = document.querySelector('.sidebar');
  if (window.innerWidth <= 768) {
    if (!sidebar.classList.contains('mobile-closed') && !sidebar.classList.contains('mobile-open')) {
      sidebar.classList.add('mobile-closed');
    }
  } else {
    sidebar.classList.remove('mobile-closed', 'mobile-open');
  }
});

// Fechar menu mobile ao clicar fora
document.addEventListener('click', function (event) {
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = document.querySelector('.menu-toggle');

  if (window.innerWidth <= 768) {
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
      sidebar.classList.remove('mobile-open');
      sidebar.classList.add('mobile-closed');
    }
  }
});


