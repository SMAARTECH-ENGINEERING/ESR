// Devices report (and the server stores) flow already in m³/h — shown as-is,
// never converted. Totalizer is stored in litres and displayed in m³.

export const FLOW_UNIT = 'm³/h';
export const VOLUME_UNIT = 'm³';

// Flow is already m³/h: no conversion, only rounded for display
export const toM3h = (flow) => (flow == null ? null : Number(Number(flow).toFixed(2)));

// litres → m³
export const toM3 = (litres) => (litres == null ? null : Number((Number(litres) / 1000).toFixed(3)));

// Display strings (undefined when there is no value, so `?? '—'` fallbacks work)
export const fmtFlow = (flow) => (flow == null ? undefined : toM3h(flow).toFixed(2));
export const fmtVolume = (litres) => (
  litres == null ? undefined : toM3(litres).toLocaleString(undefined, { maximumFractionDigits: 3 })
);
