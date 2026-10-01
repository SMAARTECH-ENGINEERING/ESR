import dayjs from 'dayjs';

export function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

// Devices report (and the server stores) flow in L/min and totalizer in litres.
// The app displays flow in m³/h and volume in m³.
export const FLOW_UNIT = 'm³/h';
export const VOLUME_UNIT = 'm³';

// L/min → m³/h
export function toM3h(lpm) {
  if (lpm === null || lpm === undefined || Number.isNaN(Number(lpm))) return null;
  return Number((Number(lpm) * 0.06).toFixed(2));
}

// litres → m³
export function toM3(litres) {
  if (litres === null || litres === undefined || Number.isNaN(Number(litres))) return null;
  return Number((Number(litres) / 1000).toFixed(3));
}

export function formatFlow(lpm) {
  return formatNumber(toM3h(lpm), 2);
}

export function formatVolume(litres) {
  return formatNumber(toM3(litres), 3);
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
