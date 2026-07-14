import { supabase } from '../supabaseClient.js';
import { vehicleStatusBadge, reservationStatusBadge, formatDateTime, escapeHtml } from '../utils.js';
import { navigate } from '../router.js';

export async function renderVehicleDetail(container, vehicleId) {
  container.innerHTML = '<p class="loading">불러오는 중...</p>';

  await load();

  const channel = supabase
    .channel(`vehicle-detail-${vehicleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `id=eq.${vehicleId}` }, load)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations', filter: `vehicle_id=eq.${vehicleId}` },
      load
    )
    .subscribe();

  return () => supabase.removeChannel(channel);

  async function load() {
    const [{ data: vehicle, error: vErr }, { data: reservations, error: rErr }] = await Promise.all([
      supabase.from('vehicles').select('*, departments:managing_dept_id(name)').eq('id', vehicleId).single(),
      supabase
        .from('v_reservations_detail')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('start_at', { ascending: false }),
    ]);

    if (vErr || !vehicle) {
      container.innerHTML = '<p class="error-text">차량 정보를 찾을 수 없습니다.</p>';
      return;
    }

    const canReserve = vehicle.status === '운행가능';

    container.innerHTML = `
      <div class="page-header">
        <button class="btn btn-ghost" id="back-btn">← 목록으로</button>
      </div>
      <div class="detail-layout">
        <section class="panel">
          <div class="vehicle-card-top">
            <h1>${escapeHtml(vehicle.model)}</h1>
            ${vehicleStatusBadge(vehicle.status)}
          </div>
          <p class="vehicle-plate-lg">${escapeHtml(vehicle.plate_number)}</p>
          <dl class="detail-grid">
            <div><dt>연식</dt><dd>${vehicle.year}</dd></div>
            <div><dt>색상</dt><dd>${escapeHtml(vehicle.color ?? '-')}</dd></div>
            <div><dt>정원</dt><dd>${vehicle.capacity}인승</dd></div>
            <div><dt>연료</dt><dd>${escapeHtml(vehicle.fuel_type)}</dd></div>
            <div><dt>관리 부서</dt><dd>${escapeHtml(vehicle.departments?.name ?? '-')}</dd></div>
            <div><dt>주차위치</dt><dd>${escapeHtml(vehicle.parking_location ?? '-')}</dd></div>
            <div class="span-2"><dt>비고</dt><dd>${escapeHtml(vehicle.note ?? '-')}</dd></div>
          </dl>
          <button class="btn btn-primary" id="reserve-btn" ${canReserve ? '' : 'disabled'}>
            ${canReserve ? '예약하기' : `예약 불가 (${vehicle.status})`}
          </button>
        </section>
        <section class="panel">
          <h2>예약 현황</h2>
          ${renderReservationList(reservations, rErr)}
        </section>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => navigate('#/vehicles'));
    if (canReserve) {
      document
        .getElementById('reserve-btn')
        .addEventListener('click', () => navigate(`#/reservations/new?vehicleId=${vehicleId}`));
    }
  }
}

function renderReservationList(list, err) {
  if (err) return `<p class="error-text">예약 현황을 불러오지 못했습니다: ${err.message}</p>`;
  if (!list || list.length === 0) return '<p class="empty-state">예약 이력이 없습니다.</p>';
  return `<table class="data-table"><thead><tr>
    <th>예약번호</th><th>예약자</th><th>부서</th><th>대여목적</th><th>출발</th><th>반납예정</th><th>실제반납</th><th>상태</th>
  </tr></thead><tbody>
  ${list
    .map(
      (r) => `<tr>
    <td>${r.reservation_code ?? '-'}</td>
    <td>${escapeHtml(r.requester_name)}</td>
    <td>${escapeHtml(r.dept_name ?? '-')}</td>
    <td>${escapeHtml(r.purpose)}</td>
    <td>${formatDateTime(r.start_at)}</td>
    <td>${formatDateTime(r.expected_end_at)}</td>
    <td>${formatDateTime(r.actual_end_at)}</td>
    <td>${reservationStatusBadge(r.status)}</td>
  </tr>`
    )
    .join('')}
  </tbody></table>`;
}
