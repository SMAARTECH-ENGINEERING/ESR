// Enterprise Blue / Red / White theme, aligned with the existing web client's
// brand colors (tailwind.config.js primary #042EF2, sidebar navy #2E3A8C).
export const colors = {
  primary: '#042EF2',
  primaryDark: '#0325C2',
  primaryLight: '#E8ECFE',
  navy: '#2E3A8C',
  navyLight: '#4F68A4',

  danger: '#D42A2A',
  dangerDark: '#A81F1F',
  dangerLight: '#FBEAEA',

  success: '#1E9E5A',
  successLight: '#E6F7EE',
  warning: '#C67C0A',
  warningLight: '#FDF3E0',

  online: '#1E9E5A',
  offline: '#D42A2A',
  inactive: '#8A93A6',

  white: '#FFFFFF',
  background: '#F4F6FB',
  surface: '#FFFFFF',
  border: '#E3E7F0',

  text: '#081021',
  textSecondary: '#515B73',
  textMuted: '#8A93A6',
  textInverse: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 21, fontWeight: '700' },
  h3: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '400' },
  bodyMedium: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600' },
};

export const shadow = {
  card: {
    shadowColor: '#0B1130',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export default { colors, spacing, radius, typography, shadow };
