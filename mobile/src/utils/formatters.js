import dayjs from 'dayjs';

export function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDateTime(value) {
  if (!value) return '--';
  return dayjs(value).format('DD MMM YYYY, hh:mm A');
}

export function formatTime(value) {
  if (!value) return '--';
  return dayjs(value).format('hh:mm A');
}

export function formatDate(value) {
  if (!value) return '--';
  return dayjs(value).format('DD MMM YYYY');
}

export function relativeFromNow(value) {
  if (!value) return '--';
  const diffMinutes = dayjs().diff(dayjs(value), 'minute');
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function roleLabel(role) {
  return role === 'admin' ? 'Administrator' : role === 'control_room' ? 'Control Room' : role;
}
