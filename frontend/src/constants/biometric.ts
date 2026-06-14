// Shared constants for the biometric device UI.

export const FINGER_NAMES: Record<number, string> = {
  0: 'Right Thumb',
  1: 'Right Index',
  2: 'Right Middle',
  3: 'Right Ring',
  4: 'Right Little',
  5: 'Left Thumb',
  6: 'Left Index',
  7: 'Left Middle',
  8: 'Left Ring',
  9: 'Left Little',
};

export type BiometricType = 'fingerprint' | 'face' | 'palm';

export type EnrollUserType = 'student' | 'teacher' | 'staff' | 'visitor';

export const ENROLL_USER_TYPES: {
  value: EnrollUserType;
  label: string;
  icon: string;
}[] = [
  { value: 'student', label: 'Students', icon: '🎓' },
  { value: 'teacher', label: 'Teachers', icon: '🧑‍🏫' },
  { value: 'staff', label: 'Other Staff', icon: '🧑‍💼' },
  { value: 'visitor', label: 'Visitors', icon: '🧳' },
];

export const BIOMETRIC_TYPES: { value: BiometricType; label: string; icon: string }[] = [
  { value: 'fingerprint', label: 'Fingerprint', icon: '👆' },
  { value: 'face', label: 'Face', icon: '😊' },
  { value: 'palm', label: 'Palm', icon: '🤚' },
];

export const DUPLICATE_PUNCH_PRESETS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

/** Compact relative-time formatter (no dayjs plugin needed). */
export function timeAgo(input?: string | null): string {
  if (!input) return '—';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '—';
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
