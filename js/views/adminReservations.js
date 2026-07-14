import { supabase } from '../supabaseClient.js';
import { reservationStatusBadge, formatDateTime, escapeHtml } from '../utils.js';

export async function renderAdminReservations(container) {
  container.innerHTML = '<p class="loading">불러오는 중...</p>';

  const { data: depts } = await supabase.from('departments').select('id, name').order('name');

  container.innerHTML = `
    <div class="page-header"><h1>관리자 - 예약 관리</h1></div>
    <div class="filter-bar">
      <select id="f-dept">
        <option value="">전체 부서</option>
        ${(depts || []).map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
      </select>
      <select id="f-status">
        <option value="">전체 상태</option>
        <option value="예약됨">예약됨</option>
        <option value="대여중">대여중</option>
        <option value="반납완료">반납완료</option>
        <option value="취소됨">취소됨</option>
      </select>
      <input type="date" id="f-from" title="시작일" />
      <input type="date" id="f-to" title="종료일" />
      <input type="search" id="f-search" placeholder="예약번호, 예약자명 검색" />
    </div>
    <div id="admin-reservation-list"><p class="loading">불러오는 중...</p></div>
  `;

  const listEl = document.getElementById('admin-reservation-list');
  const deptEl = document.getElementById('f-dept');
  const statusEl = document.getElementById('f-status');
  const fromEl = document.getElementById('f-from');
  const toEl = document.getElementById('f-to');
  const searchEl = document.getElementById('f-search');

  let debounceTimer;

  async function load() {
    listEl.innerHTML = '<p class="loading">불러오는 중...</p>';
    let query = supabase
      .from('reservations')
      .select('*, vehicles(plate_number, model), departments:dept_id(name)')
      .order('start_at', { ascending: false });

    if (deptEl.value) query = query.eq('dept_id', deptEl.value);
    if (statusEl.value) query = query.eq('status', statusEl.value);
    if (fromEl.value) query = query.gte('start_at', new Date(fromEl.value).toISOString());
    if (toEl.value) {
      const to = new Date(toEl.value);
      to.setDate(to.getDate() + 1);
      query = query.lt('start_at', to.toISOString());
    }
    const search = searchEl.value.trim();
    if (search) query = query.or(`reservation_code.ilike.%${search}%,requester_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      listEl.innerHTML = `<p class="error-text">불러오기 실패: ${error.message}</p>`;
      return;
    }
    if (!data || data.length === 0) {
      listEl.innerHTML = '<p class="empty-state">조건에 맞는 예약이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = `<table class="data-table"><thead><tr>
        <th>예약번호</th><th>차량</th><th>부서</th><th>예약자</th><th>대여목적</th><th>출발</th><th>반납예정</th><th>상태</th><th></th>
      </tr></thead><tbody>
      ${data
        .map(
          (r) => `<tr data-id="${r.id}">
        <td>${r.reservation_code ?? '-'}</td>
        <td>${escapeHtml(r.vehicles?.plate_number ?? '-')} · ${escapeHtml(r.vehicles?.model ?? '-')}</td>
        <td>${escapeHtml(r.departments?.name ?? '-')}</td>
        <td>${escapeHtml(r.requester_name)}</td>
        <td>${escapeHtml(r.purpose)}</td>
        <td>${formatDateTime(r.start_at)}</td>
        <td>${formatDateTime(r.expected_end_at)}</td>
        <td>${reservationStatusBadge(r.status)}</td>
        <td class="row-actions">${
          r.status === '예약됨' || r.status === '대여중'
            ? `<button class="btn btn-sm btn-danger-outline" data-action="force-cancel">강제 취소</button>`
            : '-'
        }</td>
      </tr>`
        )
        .join('')}
      </tbody></table>`;

    listEl.querySelectorAll('[data-action="force-cancel"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 예약을 강제 취소하시겠습니까?')) return;
        const id = btn.closest('tr').dataset.id;
        const { error } = await supabase.from('reservations').update({ status: '취소됨' }).eq('id', id);
        if (error) {
          alert(`취소 실패: ${error.message}`);
          return;
        }
        await load();
      });
    });
  }

  [deptEl, statusEl, fromEl, toEl].forEach((el) => el.addEventListener('change', load));
  searchEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 300);
  });

  await load();

  const channel = supabase
    .channel('admin-reservations-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
