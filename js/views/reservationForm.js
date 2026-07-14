import { supabase } from '../supabaseClient.js';
import { getProfile, getSession } from '../auth.js';
import { navigate } from '../router.js';
import { toLocalInputValue, escapeHtml } from '../utils.js';

export async function renderReservationForm(container, preselectedVehicleId) {
  container.innerHTML = '<p class="loading">불러오는 중...</p>';

  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, plate_number, model, status')
    .order('plate_number');

  if (error) {
    container.innerHTML = `<p class="error-text">차량 목록을 불러오지 못했습니다: ${error.message}</p>`;
    return;
  }

  const profile = getProfile();
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 3 * 60 * 60 * 1000);

  container.innerHTML = `
    <div class="page-header"><h1>예약 신청</h1></div>
    <form id="reservation-form" class="form-panel">
      <label>차량
        <select name="vehicle_id" required>
          <option value="">선택하세요</option>
          ${(vehicles || [])
            .map(
              (v) => `<option value="${v.id}" ${v.status !== '운행가능' ? 'disabled' : ''} ${
                v.id === preselectedVehicleId ? 'selected' : ''
              }>${escapeHtml(v.plate_number)} · ${escapeHtml(v.model)}${
                v.status !== '운행가능' ? ` (${v.status})` : ''
              }</option>`
            )
            .join('')}
        </select>
      </label>
      <label>대여목적
        <input type="text" name="purpose" placeholder="예: 거래처 미팅" required />
      </label>
      <label>출발일시
        <input type="datetime-local" name="start_at" value="${toLocalInputValue(defaultStart)}" required />
      </label>
      <label>반납예정일시
        <input type="datetime-local" name="expected_end_at" value="${toLocalInputValue(defaultEnd)}" required />
      </label>
      <p class="form-error" id="form-error"></p>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="cancel-btn">취소</button>
        <button type="submit" class="btn btn-primary">예약 제출</button>
      </div>
    </form>
  `;

  document.getElementById('cancel-btn').addEventListener('click', () => navigate('#/vehicles'));

  const form = document.getElementById('reservation-form');
  const errorEl = document.getElementById('form-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const fd = new FormData(form);
    const vehicleId = fd.get('vehicle_id');
    const purpose = fd.get('purpose').trim();
    const startAt = fd.get('start_at');
    const expectedEndAt = fd.get('expected_end_at');

    if (!vehicleId) {
      errorEl.textContent = '차량을 선택해주세요.';
      return;
    }
    if (new Date(expectedEndAt) <= new Date(startAt)) {
      errorEl.textContent = '반납예정일시는 출발일시보다 이후여야 합니다.';
      return;
    }

    const session = getSession();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { error: insertError } = await supabase.from('reservations').insert({
      vehicle_id: vehicleId,
      requester_id: session.user.id,
      requester_name: profile?.name ?? session.user.email,
      dept_id: profile?.department_id ?? null,
      purpose,
      start_at: new Date(startAt).toISOString(),
      expected_end_at: new Date(expectedEndAt).toISOString(),
    });

    submitBtn.disabled = false;

    if (insertError) {
      errorEl.textContent = translateReservationError(insertError);
      return;
    }

    navigate('#/my-reservations');
  });
}

function translateReservationError(err) {
  if (err.code === '23P01') return '해당 시간대는 이미 예약이 있습니다. 다른 시간을 선택해주세요.';
  if (err.code === '23514') return '입력 값을 확인해주세요. (반납예정일시는 출발일시 이후여야 합니다)';
  return `예약에 실패했습니다: ${err.message}`;
}
