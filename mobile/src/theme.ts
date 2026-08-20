export const colors = {
  primary: '#4338ca',
  primaryDark: '#3730a3',
  primaryLight: '#eef2ff',
  primarySoft: '#e0e7ff',
  accent: '#0ea5e9',

  ink: '#0f172a',
  body: '#475569',
  muted: '#64748b',
  faint: '#94a3b8',

  bg: '#f4f5fb',
  surface: '#ffffff',
  border: '#e7e9f5',
  divider: '#eef0f9',

  success: '#16a34a',
  successBg: '#ecfdf3',
  successBorder: '#bbf7d0',
  danger: '#e11d48',
  dangerBg: '#fef2f4',
  dangerBorder: '#fecdd6',
  warning: '#d97706',
  warningBg: '#fffbeb',
  warningBorder: '#fde8b8',
  info: '#0891b2',
  infoBg: '#ecfeff',
  infoBorder: '#a5f3fc',
} as const;

export const statusColors: Record<string, { fg: string; bg: string; border: string }> = {
  present: { fg: colors.success, bg: colors.successBg, border: colors.successBorder },
  absent: { fg: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder },
  late: { fg: colors.warning, bg: colors.warningBg, border: colors.warningBorder },
  half_day: { fg: colors.info, bg: colors.infoBg, border: colors.infoBorder },
  holiday: { fg: colors.muted, bg: colors.divider, border: colors.border },
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const shadow = {
  card: {
    shadowColor: '#1e2a5e',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#1e2a5e',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

export const SUBJECT_PALETTE = ['#4338ca', '#0ea5e9', '#16a34a', '#d97706', '#e11d48', '#7c3aed', '#0891b2'];

export function colorForKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
