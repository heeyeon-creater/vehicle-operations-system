import { supabase } from '../supabaseClient.js';
import { signIn, signUp } from '../auth.js';

let mode = 'login';
let departmentsCache = null;

export async function renderLogin(container) {
  if (!departmentsCache) {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    departmentsCache = data || [];
  }

  container.innerHTML = `
    <div class="auth-card">
      <p class="auth-eyebrow">차량운영시스템</p>
      <h1 class="auth-title">${mode === 'signup' ? '회원가입' : '로그인'}</h1>
      <div class="auth-tabs">
        <button type="button" class="auth-tab ${mode === 'login' ? 'active' : ''}" data-mode="login">로그인</button>
        <button type="button" class="auth-tab ${mode === 'signup' ? 'active' : ''}" data-mode="signup">회원가입</button>
      </div>
      <form id="auth-form" class="auth-form">
        ${mode === 'signup' ? `
          <label>이름
            <input name="name" required autocomplete="name" />
          </label>
          <label>부서
            <select name="department_id">
              ${departmentsCache.map((d) => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
          </label>
        ` : ''}
        <label>이메일
          <input type="email" name="email" required autocomplete="email" />
        </label>
        <label>비밀번호
          <input type="password" name="password" required minlength="6" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" />
        </label>
        <p class="form-error" id="auth-error"></p>
        <p class="form-info" id="auth-info"></p>
        <button type="submit" class="btn btn-primary btn-block">${mode === 'signup' ? '가입하기' : '로그인'}</button>
      </form>
    </div>
  `;

  container.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      renderLogin(container);
    });
  });

  const form = document.getElementById('auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    const infoEl = document.getElementById('auth-info');
    errorEl.textContent = '';
    infoEl.textContent = '';

    const fd = new FormData(form);
    const email = fd.get('email').trim();
    const password = fd.get('password');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (mode === 'signup') {
        const name = fd.get('name').trim();
        const departmentId = fd.get('department_id');
        const data = await signUp({ email, password, name, departmentId });
        if (!data.session) {
          infoEl.textContent = '가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.';
          mode = 'login';
        }
        // 세션이 바로 발급된 경우(이메일 인증 비활성) auth 상태 변경 리스너가 자동으로 화면을 전환한다.
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      errorEl.textContent = translateAuthError(err);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function translateAuthError(err) {
  const msg = err?.message || '';
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (msg.includes('User already registered')) return '이미 가입된 이메일입니다.';
  if (msg.toLowerCase().includes('password should be at least')) return '비밀번호는 6자 이상이어야 합니다.';
  if (msg.includes('rate limit')) return '잠시 후 다시 시도해주세요.';
  return `오류가 발생했습니다: ${msg}`;
}
