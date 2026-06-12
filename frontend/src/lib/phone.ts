// Country dial codes for the mobile / WhatsApp fields. Default is India (+91),
// since EduPro is India-first; the common Gulf + neighbouring countries cover
// most NRI parents.
export interface CountryCode {
  code: string; // dial code incl. '+', e.g. '+91'
  label: string; // shown in the dropdown
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+91', label: '🇮🇳 +91 India' },
  { code: '+971', label: '🇦🇪 +971 UAE' },
  { code: '+966', label: '🇸🇦 +966 Saudi Arabia' },
  { code: '+974', label: '🇶🇦 +974 Qatar' },
  { code: '+965', label: '🇰🇼 +965 Kuwait' },
  { code: '+968', label: '🇴🇲 +968 Oman' },
  { code: '+973', label: '🇧🇭 +973 Bahrain' },
  { code: '+1', label: '🇺🇸 +1 USA / Canada' },
  { code: '+44', label: '🇬🇧 +44 UK' },
  { code: '+61', label: '🇦🇺 +61 Australia' },
  { code: '+65', label: '🇸🇬 +65 Singapore' },
  { code: '+60', label: '🇲🇾 +60 Malaysia' },
  { code: '+94', label: '🇱🇰 +94 Sri Lanka' },
  { code: '+977', label: '🇳🇵 +977 Nepal' },
  { code: '+880', label: '🇧🇩 +880 Bangladesh' },
  { code: '+49', label: '🇩🇪 +49 Germany' },
  { code: '+33', label: '🇫🇷 +33 France' },
];

export const DEFAULT_COUNTRY_CODE = '+91';

/** Compose a displayable number, e.g. ('+91', '9876543210') → '+91 9876543210'. */
export function formatPhone(
  code?: string | null,
  number?: string | null,
): string | null {
  if (!number) return null;
  return code ? `${code} ${number}` : number;
}
