export function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const VEHICLE_STATUS_CLASS = {
  운행가능: 'success',
  운행중: 'warning',
  정비중: 'danger',
};

export function vehicleStatusBadge(status) {
  const cls = VEHICLE_STATUS_CLASS[status] || 'neutral';
  return `<span class="badge badge-${cls}">${escapeHtml(status)}</span>`;
}

const RESERVATION_STATUS_CLASS = {
  예약됨: 'info',
  대여중: 'warning',
  반납완료: 'success',
  취소됨: 'neutral',
};

export function reservationStatusBadge(status) {
  const cls = RESERVATION_STATUS_CLASS[status] || 'neutral';
  return `<span class="badge badge-${cls}">${escapeHtml(status)}</span>`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
