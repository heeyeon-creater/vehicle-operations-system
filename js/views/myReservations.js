import { supabase } from '../supabaseClient.js';
import { getSession } from '../auth.js';
import { reservationStatusBadge, formatDateTime, escapeHtml } from '../utils.js';

export async function renderMyReservations(container) {
  const session = getSession();

  container.innerHTML = `
    <div class="page-header"><h1>나의 예약 내역</h1></div>
    <div class="filter-bar">
      <select id="f-status">
        <option value="">전체</option>
        <option value="예약됨">예정</option>
        <option value="대여중">대여중</option>
        <option value="반납완료">완료</option>
        <option value="취소됨">취소</option>
      </select>
    </div>
    <div id="reservation-list"><p class="loading">불러오는 중...</p></div>
  `;

  const listEl = document.getElementById('reservation-list');
  const statusEl = document.getElementById('f-status');

  async function load() {
    listEl.innerHTML = '<p class="loading">불러오는 중...</p>';
    let query = supabase
      .from('reservations')
      .select('*, vehicles(plate_number, model)')
      .eq('requester_id', session.user.id)
      .order('start_at', { ascending: false });
    if (statusEl.value) query = query.eq('status', statusEl.value);

    const { data, error } = await query;
    if (error) {
      listEl.innerHTML = `<p class="error-text">예약 내역을 불러오지 못했습니다: ${error.message}</p>`;
      return;
    }
    if (!data || data.length === 0) {
      listEl.innerHTML = '<p class="empty-state">예약 내역이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = `<table class="data-table"><thead><tr>
        <th>예약번호</th><th>차량</th><th>대여목적</th><th>출발</th><th>반납예정</th><th>실제반납</th><th>상태</th><th></th>
      </tr></thead><tbody>
      ${data
        .map(
          (r) => `<tr data-id="${r.id}">
        <td>${r.reservation_code ?? '-'}</td>
        <td>${escapeHtml(r.vehicles?.plate_number ?? '-')} · ${escapeHtml(r.vehicles?.model ?? '-')}</td>
        <td>${escapeHtml(r.purpose)}</td>
        <td>${formatDateTime(r.start_at)}</td>
        <td>${formatDateTime(r.expected_end_at)}</td>
        <td>${formatDateTime(r.actual_end_at)}</td>
        <td>${reservationStatusBadge(r.status)}${isOverdue(r) ? ' <span class="badge badge-danger">지연</span>' : ''}</td>
        <td class="row-actions">${renderActions(r)}</td>
      </tr>`
        )
        .join('')}
      </tbody></table>`;

    listEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.closest('tr').dataset.id));
    });
  }

  function isOverdue(r) {
    return r.status === '대여중' && new Date(r.expected_end_at) < new Date();
  }

  function renderActions(r) {
    if (r.status === '예약됨') {
      return `<button class="btn btn-sm" data-action="start">출발 처리</button> <button class="btn btn-sm btn-danger-outline" data-action="cancel">취소</button>`;
    }
    if (r.status === '대여중') {
      return `<button class="btn btn-sm" data-action="return">반납 처리</button>`;
    }
    return '-';
  }

  async function handleAction(action, id) {
    if (action === 'cancel') {
      if (!confirm('예약을 취소하시겠습니까?')) return;
      const { error } = await supabase.from('reservations').update({ status: '취소됨' }).eq('id', id);
      if (error) {
        alert(`취소 실패: ${error.message}`);
        return;
      }
    } else if (action === 'start') {
      const { error } = await supabase.from('reservations').update({ status: '대여중' }).eq('id', id);
      if (error) {
        alert(`출발 처리 실패: ${error.message}`);
        return;
      }
    } else if (action === 'return') {
      const { error } = await supabase
        .from('reservations')
        .update({ status: '반납완료', actual_end_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        alert(`반납 처리 실패: ${error.message}`);
        return;
      }
    }
    await load();
  }

  statusEl.addEventListener('change', load);
  await load();

  const channel = supabase
    .channel('my-reservations-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations', filter: `requester_id=eq.${session.user.id}` },
      load
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
