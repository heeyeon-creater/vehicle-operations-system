import { supabase } from '../supabaseClient.js';
import { vehicleStatusBadge, escapeHtml } from '../utils.js';

export async function renderAdminVehicles(container) {
  container.innerHTML = '<p class="loading">불러오는 중...</p>';

  const { data: depts } = await supabase.from('departments').select('id, name').order('name');
  const departments = depts || [];

  container.innerHTML = `
    <div class="page-header">
      <h1>관리자 - 차량 관리</h1>
      <button class="btn btn-primary" id="new-vehicle-btn">차량 등록</button>
    </div>
    <div id="vehicle-form-wrap"></div>
    <div id="admin-vehicle-list"><p class="loading">불러오는 중...</p></div>
  `;

  document.getElementById('new-vehicle-btn').addEventListener('click', () => openForm());

  await load();

  const channel = supabase
    .channel('admin-vehicles-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, load)
    .subscribe();

  return () => supabase.removeChannel(channel);

  async function load() {
    const listEl = document.getElementById('admin-vehicle-list');
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, departments:managing_dept_id(name)')
      .order('plate_number');
    if (error) {
      listEl.innerHTML = `<p class="error-text">불러오기 실패: ${error.message}</p>`;
      return;
    }

    listEl.innerHTML = `<table class="data-table"><thead><tr>
        <th>차량번호</th><th>차종</th><th>부서</th><th>정원</th><th>연료</th><th>상태</th><th></th>
      </tr></thead><tbody>
      ${data
        .map(
          (v) => `<tr data-id="${v.id}">
        <td>${escapeHtml(v.plate_number)}</td>
        <td>${escapeHtml(v.model)}</td>
        <td>${escapeHtml(v.departments?.name ?? '-')}</td>
        <td>${v.capacity}</td>
        <td>${escapeHtml(v.fuel_type)}</td>
        <td>${vehicleStatusBadge(v.status)}</td>
        <td class="row-actions">
          <button class="btn btn-sm" data-action="edit">수정</button>
          ${
            v.status === '정비중'
              ? `<button class="btn btn-sm" data-action="unmaintain">정비 해제</button>`
              : `<button class="btn btn-sm btn-danger-outline" data-action="maintain">정비중 등록</button>`
          }
          <button class="btn btn-sm btn-danger-outline" data-action="delete">삭제</button>
        </td>
      </tr>`
        )
        .join('')}
      </tbody></table>`;

    listEl.querySelectorAll('[data-action]').forEach((btn) => {
      const id = btn.closest('tr').dataset.id;
      const vehicle = data.find((v) => v.id === id);
      btn.addEventListener('click', () => handleAction(btn.dataset.action, vehicle));
    });
  }

  async function handleAction(action, vehicle) {
    if (action === 'edit') {
      openForm(vehicle);
      return;
    }
    if (action === 'delete') {
      if (!confirm(`${vehicle.plate_number} 차량을 삭제하시겠습니까?`)) return;
      const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);
      if (error) alert(`삭제 실패: ${error.message}`);
      await load();
      return;
    }
    if (action === 'maintain') {
      const { error } = await supabase.from('vehicles').update({ status: '정비중' }).eq('id', vehicle.id);
      if (error) alert(`상태 변경 실패: ${error.message}`);
      await load();
      return;
    }
    if (action === 'unmaintain') {
      const { error } = await supabase.from('vehicles').update({ status: '운행가능' }).eq('id', vehicle.id);
      if (error) alert(`상태 변경 실패: ${error.message}`);
      await load();
    }
  }

  function openForm(vehicle = null) {
    const wrap = document.getElementById('vehicle-form-wrap');
    wrap.innerHTML = `
      <form id="vehicle-form" class="form-panel">
        <h3>${vehicle ? '차량 수정' : '차량 등록'}</h3>
        <label>차량번호 <input name="plate_number" required value="${escapeHtml(vehicle?.plate_number ?? '')}" /></label>
        <label>차종 <input name="model" required value="${escapeHtml(vehicle?.model ?? '')}" /></label>
        <label>연식 <input type="number" name="year" required min="1990" max="2100" value="${vehicle?.year ?? new Date().getFullYear()}" /></label>
        <label>색상 <input name="color" value="${escapeHtml(vehicle?.color ?? '')}" /></label>
        <label>정원 <input type="number" name="capacity" required min="1" value="${vehicle?.capacity ?? 5}" /></label>
        <label>연료
          <select name="fuel_type">
            ${['가솔린', '디젤', '하이브리드', '전기']
              .map((f) => `<option ${vehicle?.fuel_type === f ? 'selected' : ''}>${f}</option>`)
              .join('')}
          </select>
        </label>
        <label>관리 부서
          <select name="managing_dept_id">
            ${departments
              .map((d) => `<option value="${d.id}" ${vehicle?.managing_dept_id === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label>상태
          <select name="status">
            ${['운행가능', '운행중', '정비중']
              .map((s) => `<option ${vehicle?.status === s ? 'selected' : ''}>${s}</option>`)
              .join('')}
          </select>
        </label>
        <label>주차위치 <input name="parking_location" value="${escapeHtml(vehicle?.parking_location ?? '')}" /></label>
        <label>비고 <input name="note" value="${escapeHtml(vehicle?.note ?? '')}" /></label>
        <p class="form-error" id="vehicle-form-error"></p>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancel-vehicle-form">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>
    `;

    document.getElementById('cancel-vehicle-form').addEventListener('click', () => {
      wrap.innerHTML = '';
    });

    document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        plate_number: fd.get('plate_number').trim(),
        model: fd.get('model').trim(),
        year: Number(fd.get('year')),
        color: fd.get('color').trim() || null,
        capacity: Number(fd.get('capacity')),
        fuel_type: fd.get('fuel_type'),
        managing_dept_id: fd.get('managing_dept_id') || null,
        status: fd.get('status'),
        parking_location: fd.get('parking_location').trim() || null,
        note: fd.get('note').trim() || null,
      };
      const errorEl = document.getElementById('vehicle-form-error');
      let error;
      if (vehicle) {
        ({ error } = await supabase.from('vehicles').update(payload).eq('id', vehicle.id));
      } else {
        ({ error } = await supabase.from('vehicles').insert(payload));
      }
      if (error) {
        errorEl.textContent = error.code === '23505' ? '이미 등록된 차량번호입니다.' : `저장 실패: ${error.message}`;
        return;
      }
      wrap.innerHTML = '';
      await load();
    });
  }
}
