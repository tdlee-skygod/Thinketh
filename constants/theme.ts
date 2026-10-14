export const COLORS = {
  primaryDark: '#1e1b4b',
  primary: '#5b21b6',
  primaryLight: '#7c3aed',
  accentLavender: '#a78bfa',
  accentLavenderLight: '#c4b5fd',
  border: '#ddd6fe',
  borderLight: '#ede9ff',
  bgLight: '#f5f0ff',
  bgLighter: '#faf8ff',
  gold: '#fbbf24',
  textDark: '#1e1b4b',
  textMuted: '#999999',
  white: '#ffffff',
  danger: '#ef4444',
  // Time 탭(F-21) 항목별 색상 — 남은=primary, 버려진=waste(빨강), 나의 것=mine(초록), 지난=pastWash(무채)
  waste: '#c8402f',
  wasteWash: '#fbe6e2',
  mine: '#178a5c',
  mineWash: '#e1f5ec',
  pastWash: '#efedf9',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 20,
} as const;

export const FONT = {
  size: {
    xs: 10,
    sm: 11,
    md: 13,
    lg: 14,
    xl: 16,
    xxl: 18,
    title: 28,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  familyFND: {
    regular: 'DSEG7Classic-Regular',
    bold: 'DSEG7Classic-Bold',
  },
} as const;
