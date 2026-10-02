// Devices report (and the server stores) flow in m³/h and totalizer in m³.
// Both are shown as-is, never converted.

export const FLOW_UNIT = 'm³/h';
export const VOLUME_UNIT = 'm³';

// Flow is already m³/h: no conversion, only rounded for display
export const toM3h = (flow) => (flow == null ? null : Number(Number(flow).toFixed(2)));

// Totalizer is already m³: no conversion, only rounded for display
export const toM3 = (volume) => (volume == null ? null : Number(Number(volume).toFixed(1)));

// Display strings (undefined when there is no value, so `?? '—'` fallbacks work)
export const fmtFlow = (flow) => (flow == null ? undefined : toM3h(flow).toFixed(2));
// Volume is a plain number with one decimal (no thousands separators)
export const fmtVolume = (volume) => (volume == null ? undefined : toM3(volume).toFixed(1));
