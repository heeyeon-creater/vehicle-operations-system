import { initAuth, onAuthChange, getSession, getProfile, isAdmin, signOut } from './auth.js';
import { registerRoute, startRouter, navigate } from './router.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderVehicles } from './views/vehicles.js';
import { renderVehicleDetail } from './views/vehicleDetail.js';
import { renderReservationForm } from './views/reservationForm.js';
import { renderMyReservations } from './views/myReservations.js';
import { renderAdminVehicles } from './views/adminVehicles.js';
import { renderAdminReservations } from './views/adminReservations.js';

const contentEl = document.getElementById('content');
const shellEl = document.getElementById('app-shell');
const authViewEl = document.getElementById('auth-view');
const userNameEl = document.getElementById('current-user-name');
const userDeptEl = document.getElementById('current-user-dept');
const navLinks = document.querySelectorAll('.nav-link');

function updateShellVisibility() {
  const session = getSession();
  if (session) {
    shellEl.classList.remove('hidden');
    authViewEl.classList.add('hidden');
    const profile = getProfile();
    userNameEl.textContent = profile?.name ?? session.user.email;
    userDeptEl.textContent = profile?.departments?.name ?? '';
    document.querySelectorAll('.nav-admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin()));
  } else {
    shellEl.classList.add('hidden');
    authViewEl.classList.remove('hidden');
  }
}

function updateActiveNav() {
  const current = location.hash || '#/dashboard';
  navLinks.forEach((link) => {
    const target = link.getAttribute('href');
    link.classList.toggle('active', current === target || current.startsWith(`${target}/`));
  });
}
window.addEventListener('hashchange', updateActiveNav);

function requireAuth(handler) {
  return async (params) => {
    if (!getSession()) {
      navigate('#/login');
      return undefined;
    }
    return handler(params);
  };
}

function requireAdmin(handler) {
  return async (params) => {
    if (!getSession()) {
      navigate('#/login');
      return undefined;
    }
    if (!isAdmin()) {
      contentEl.innerHTML = '<p class="empty-state">접근 권한이 없습니다.</p>';
      return undefined;
    }
    return handler(params);
  };
}

registerRoute(/^#\/login$/, async () => {
  if (getSession()) {
    navigate('#/dashboard');
    return undefined;
  }
  return renderLogin(authViewEl);
});

registerRoute(/^#\/dashboard$/, requireAuth(() => renderDashboard(contentEl)));
registerRoute(/^#\/vehicles$/, requireAuth(() => renderVehicles(contentEl)));
registerRoute(/^#\/vehicles\/(?<id>[^/]+)$/, requireAuth((params) => renderVehicleDetail(contentEl, params.id)));
registerRoute(
  /^#\/reservations\/new$/,
  requireAuth((params) => renderReservationForm(contentEl, params.query?.vehicleId))
);
registerRoute(/^#\/my-reservations$/, requireAuth(() => renderMyReservations(contentEl)));
registerRoute(/^#\/admin\/vehicles$/, requireAdmin(() => renderAdminVehicles(contentEl)));
registerRoute(/^#\/admin\/reservations$/, requireAdmin(() => renderAdminReservations(contentEl)));

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
});

onAuthChange(() => {
  updateShellVisibility();
  const session = getSession();
  if (!session) {
    navigate('#/login');
  } else if (!location.hash || location.hash === '#/login') {
    // 로그인/회원가입 직후: 로그인 화면에 머물러 있던 라우트를 대시보드로 전환한다.
    navigate('#/dashboard');
  }
});

(async function init() {
  await initAuth();
  updateShellVisibility();
  updateActiveNav();
  await startRouter(getSession() ? '#/dashboard' : '#/login');
  updateActiveNav();
})();
