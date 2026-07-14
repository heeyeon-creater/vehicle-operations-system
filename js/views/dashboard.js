import { supabase } from '../supabaseClient.js';
import { reservationStatusBadge, formatDateTime } from '../utils.js';
import { navigate } from '../router.js';

export async function renderDashboard(container) {
  container.innerHTML = '<p class="loading">불러오는 중...</p>';

  await load();

  const channel = supabase
    .channel('dashboard-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
    .subscribe();

  return () => supabase.removeChannel(channel);

  async function load() {
    const [{ data: vehicles, error: vErr }, { data: todayReservations, error: rErr }] = await Promise.all([
      supabase.from('vehicles').select('status'),
      fetchTodayReservations(),
    ]);

    if (vErr) {
      container.innerHTML = `<p class="error-text">차량 정보를 불러오지 못했습니다: ${vErr.message}</p>`;
      return;
    }

    const counts = { 운행가능: 0, 운행중: 0, 정비중: 0 };
    (vehicles || []).forEach((v) => {
      counts[v.status] = (counts[v.status] || 0) + 1;
    });

    container.innerHTML = `
      <div class="page-header">
        <h1>대시보드</h1>
        <button class="btn btn-primary" id="quick-reserve-btn">차량 둘러보기</button>
      </div>
      <section class="stat-cards">
        <div class="stat-card">
          <div class="stat-label">전체 차량</div>
          <div class="stat-value">${(vehicles || []).length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">운행가능</div>
          <div class="stat-value stat-success">${counts['운행가능']}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">운행중</div>
          <div class="stat-value stat-warning">${counts['운행중']}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">정비중</div>
          <div class="stat-value stat-danger">${counts['정비중']}</div>
        </div>
      </section>
      <section class="panel">
        <h2>오늘 출발/반납 예정</h2>
        ${renderTodayList(todayReservations, rErr)}
      </section>
    `;

    document.getElementById('quick-reserve-btn')?.addEventListener('click', () => navigate('#/vehicles'));
  }
}

async function fetchTodayReservations() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  return supabase
    .from('v_reservations_detail')
    .select('*')
    .in('status', ['예약됨', '대여중'])
    .or(
      `and(start_at.gte.${startIso},start_at.lt.${endIso}),and(expected_end_at.gte.${startIso},expected_end_at.lt.${endIso})`
    )
    .order('start_at');
}

function renderTodayList(list, err) {
  if (err) return `<p class="error-text">일정을 불러오지 못했습니다: ${err.message}</p>`;
  if (!list || list.length === 0) return '<p class="empty-state">오늘 예정된 출발/반납이 없습니다.</p>';
  return `<table class="data-table"><thead><tr>
      <th>예약번호</th><th>차량</th><th>부서</th><th>예약자</th><th>출발</th><th>반납예정</th><th>상태</th>
    </tr></thead><tbody>
    ${list
      .map(
        (r) => `<tr>
      <td>${r.reservation_code ?? '-'}</td>
      <td>${r.plate_number} · ${r.model}</td>
      <td>${r.dept_name ?? '-'}</td>
      <td>${r.requester_name}</td>
      <td>${formatDateTime(r.start_at)}</td>
      <td>${formatDateTime(r.expected_end_at)}</td>
      <td>${reservationStatusBadge(r.status)}</td>
    </tr>`
      )
      .join('')}
    </tbody></table>`;
}
