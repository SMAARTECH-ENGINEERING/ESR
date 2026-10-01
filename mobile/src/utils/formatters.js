import dayjs from 'dayjs';

export function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

// Devices report (and the server stores) flow in m³/h and totalizer in m³.
// Both are shown as-is, never converted.
export const FLOW_UNIT = 'm³/h';
export const VOLUME_UNIT = 'm³';

// Flow is already m³/h: no conversion, only rounded for display
export function toM3h(flow) {
  if (flow === null || flow === undefined || Number.isNaN(Number(flow))) return null;
  return Number(Number(flow).toFixed(2));
}

// Totalizer is already m³: no conversion, only rounded for display
export function toM3(volume) {
  if (volume === null || volume === undefined || Number.isNaN(Number(volume))) return null;
  return Number(Number(volume).toFixed(3));
}

export function formatFlow(flow) {
  return formatNumber(toM3h(flow), 2);
}

export function formatVolume(volume) {
  return formatNumber(toM3(volume), 3);
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
