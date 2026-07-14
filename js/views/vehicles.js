import { supabase } from '../supabaseClient.js';
import { vehicleStatusBadge, escapeHtml } from '../utils.js';
import { navigate } from '../router.js';

let cachedDepartments = null;
let cachedYears = null;

export async function renderVehicles(container) {
  container.innerHTML = '<p class="loading">불러오는 중...</p>';

  if (!cachedDepartments) {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    cachedDepartments = data || [];
  }
  if (!cachedYears) {
    const { data } = await supabase.from('vehicles').select('year');
    cachedYears = [...new Set((data || []).map((v) => v.year))].sort((a, b) => b - a);
  }

  container.innerHTML = `
    <div class="page-header"><h1>차량 목록</h1></div>
    <div class="filter-bar">
      <input type="search" id="f-search" placeholder="차량번호, 차종 검색" />
      <select id="f-status">
        <option value="">전체 상태</option>
        <option value="운행가능">운행가능</option>
        <option value="운행중">운행중</option>
        <option value="정비중">정비중</option>
      </select>
      <select id="f-dept">
        <option value="">전체 부서</option>
        ${cachedDepartments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
      </select>
      <select id="f-fuel">
        <option value="">전체 연료</option>
        <option value="가솔린">가솔린</option>
        <option value="디젤">디젤</option>
        <option value="하이브리드">하이브리드</option>
        <option value="전기">전기</option>
      </select>
      <select id="f-capacity">
        <option value="">전체 정원</option>
        <option value="4">4인승 이하</option>
        <option value="5">5인승</option>
        <option value="7">7인승 이상</option>
      </select>
      <select id="f-year">
        <option value="">전체 연식</option>
        ${cachedYears.map((y) => `<option value="${y}">${y}년</option>`).join('')}
      </select>
      <select id="f-sort">
        <option value="plate_number">차량번호순</option>
        <option value="status">상태순</option>
      </select>
    </div>
    <div id="vehicle-list" class="vehicle-grid"><p class="loading">불러오는 중...</p></div>
  `;

  const listEl = document.getElementById('vehicle-list');
  const searchEl = document.getElementById('f-search');
  const statusEl = document.getElementById('f-status');
  const deptEl = document.getElementById('f-dept');
  const fuelEl = document.getElementById('f-fuel');
  const capacityEl = document.getElementById('f-capacity');
  const yearEl = document.getElementById('f-year');
  const sortEl = document.getElementById('f-sort');

  let debounceTimer;

  async function load() {
    listEl.innerHTML = '<p class="loading">불러오는 중...</p>';
    let query = supabase.from('vehicles').select('*, departments:managing_dept_id(name)');

    if (statusEl.value) query = query.eq('status', statusEl.value);
    if (deptEl.value) query = query.eq('managing_dept_id', deptEl.value);
    if (fuelEl.value) query = query.eq('fuel_type', fuelEl.value);
    if (capacityEl.value === '4') query = query.lte('capacity', 4);
    if (capacityEl.value === '5') query = query.eq('capacity', 5);
    if (capacityEl.value === '7') query = query.gte('capacity', 7);
    if (yearEl.value) query = query.eq('year', Number(yearEl.value));

    const search = searchEl.value.trim();
    if (search) query = query.or(`plate_number.ilike.%${search}%,model.ilike.%${search}%`);

    query = query.order(sortEl.value === 'status' ? 'status' : 'plate_number');

    const { data, error } = await query;
    if (error) {
      listEl.innerHTML = `<p class="error-text">차량 목록을 불러오지 못했습니다: ${error.message}</p>`;
      return;
    }
    if (!data || data.length === 0) {
      listEl.innerHTML = '<p class="empty-state">조건에 맞는 차량이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = data
      .map(
        (v) => `
      <article class="vehicle-card" data-id="${v.id}" tabindex="0">
        <div class="vehicle-card-top">
          <h3>${escapeHtml(v.model)}</h3>
          ${vehicleStatusBadge(v.status)}
        </div>
        <p class="vehicle-plate">${escapeHtml(v.plate_number)}</p>
        <dl class="vehicle-meta">
          <div><dt>부서</dt><dd>${escapeHtml(v.departments?.name ?? '-')}</dd></div>
          <div><dt>연료</dt><dd>${escapeHtml(v.fuel_type)}</dd></div>
          <div><dt>정원</dt><dd>${v.capacity}인승</dd></div>
          <div><dt>연식</dt><dd>${v.year}</dd></div>
        </dl>
      </article>
    `
      )
      .join('');

    listEl.querySelectorAll('.vehicle-card').forEach((card) => {
      card.addEventListener('click', () => navigate(`#/vehicles/${card.dataset.id}`));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(`#/vehicles/${card.dataset.id}`);
      });
    });
  }

  [statusEl, deptEl, fuelEl, capacityEl, yearEl, sortEl].forEach((el) => el.addEventListener('change', load));
  searchEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 300);
  });

  await load();

  const channel = supabase
    .channel('vehicles-list-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, load)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
