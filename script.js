const API = window.API_BASE_URL || 'http://localhost:3001/api';
let tokenTemporario = null;

// ==================== UI ====================
function showError(id, message) {
  const container = document.getElementById(id);
  container.innerHTML = `<div class="error-message">${message}</div>`;
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

function clearError(id) {
  document.getElementById(id).innerHTML = '';
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const visivel = input.type === 'text';

  // O ícone (olho / olho cortado) é trocado pelo CSS, que observa o type do input.
  input.type = visivel ? 'password' : 'text';

  const botao = input.parentElement.querySelector('.toggle-password');
  if (botao) botao.setAttribute('aria-label', visivel ? 'Mostrar a senha' : 'Ocultar a senha');
}

// ==================== LOGIN ====================
async function login() {
  const email = document.getElementById('user').value.trim();
  const pass = document.getElementById('pass').value;
  const loginBtn = document.getElementById('login-btn');
  const btnText = document.getElementById('btn-text');
  const btnLoader = document.getElementById('btn-loader');

  clearError('error-container');

  if (!email) return showError('error-container', 'Digite seu email');
  if (!pass) return showError('error-container', 'Digite sua senha');

  loginBtn.disabled = true;
  btnText.style.opacity = '0';
  btnLoader.style.display = 'block';

  try {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });

    const data = await response.json();

    if (data.sucesso) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', data.usuario.username);
      localStorage.setItem('userType', data.usuario.tipo);

      if (data.primeiro_acesso) {
        tokenTemporario = data.token;
        document.getElementById('step-login').style.display = 'none';
        document.getElementById('step-senha').style.display = 'block';
        document.getElementById('nova-senha').focus();
      } else {
        window.location.href = 'Dash/dashboard.html';
      }
    } else {
      throw new Error(data.mensagem);
    }

  } catch (error) {
    showError('error-container', error.message || 'Erro ao fazer login');
    document.getElementById('pass').value = '';
  } finally {
    loginBtn.disabled = false;
    btnText.style.opacity = '1';
    btnLoader.style.display = 'none';
  }
}

// ==================== DEFINIR SENHA ====================
async function definirSenha() {
  const novaSenha = document.getElementById('nova-senha').value;
  const confirmaSenha = document.getElementById('confirma-senha').value;
  const btn = document.getElementById('senha-btn');
  const btnText = document.getElementById('senha-btn-text');
  const btnLoader = document.getElementById('senha-btn-loader');

  clearError('error-container-senha');

  if (!novaSenha || novaSenha.length < 6) return showError('error-container-senha', 'A senha deve ter no mínimo 6 caracteres');
  if (novaSenha !== confirmaSenha) return showError('error-container-senha', 'As senhas não coincidem');

  btn.disabled = true;
  btnText.style.opacity = '0';
  btnLoader.style.display = 'block';

  try {
    const token = tokenTemporario || localStorage.getItem('token');
    const response = await fetch(`${API}/auth/definir-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ novaSenha })
    });

    const data = await response.json();

    if (data.sucesso) {
      window.location.href = 'Dash/dashboard.html';
    } else {
      throw new Error(data.mensagem);
    }

  } catch (error) {
    showError('error-container-senha', error.message || 'Erro ao definir senha');
  } finally {
    btn.disabled = false;
    btnText.style.opacity = '1';
    btnLoader.style.display = 'none';
  }
}

// ==================== EVENTOS ====================
document.addEventListener('DOMContentLoaded', function () {
  const passInput = document.getElementById('pass');
  const userInput = document.getElementById('user');

  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); login(); } });
  userInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); passInput.focus(); } });
  userInput.addEventListener('input', () => clearError('error-container'));
  passInput.addEventListener('input', () => clearError('error-container'));

  document.getElementById('nova-senha')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('confirma-senha').focus(); }
  });
  document.getElementById('confirma-senha')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); definirSenha(); }
  });
});
