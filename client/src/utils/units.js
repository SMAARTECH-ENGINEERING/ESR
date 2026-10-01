// Devices report (and the server stores) flow in L/min and totalizer in litres.
// The UI displays flow in m³/h and volume in m³.

export const FLOW_UNIT = 'm³/h';
export const VOLUME_UNIT = 'm³';

// L/min → m³/h
export const toM3h = (lpm) => (lpm == null ? null : Number((Number(lpm) * 0.06).toFixed(2)));

// litres → m³
export const toM3 = (litres) => (litres == null ? null : Number((Number(litres) / 1000).toFixed(3)));

// Display strings (undefined when there is no value, so `?? '—'` fallbacks work)
export const fmtFlow = (lpm) => (lpm == null ? undefined : toM3h(lpm).toFixed(2));
export const fmtVolume = (litres) => (
  litres == null ? undefined : toM3(litres).toLocaleString(undefined, { maximumFractionDigits: 3 })
);
