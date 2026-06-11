import dayjs from 'dayjs';

export const PAISE_PER_RUPEE = 100;

export function paiseToRupees(paise: number | string | null | undefined): number {
  if (paise == null || paise === '') return 0;
  return Number(paise) / PAISE_PER_RUPEE;
}

export function rupeesToPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * PAISE_PER_RUPEE);
}

export function formatMoney(
  paise: number | string | null | undefined,
  currency = 'INR',
): string {
  const r = paiseToRupees(paise);
  if (currency === 'INR') {
    return `₹${r.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(r);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY');
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY HH:mm');
}

export function formatLimit(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === -1) return 'Unlimited';
  return n.toLocaleString('en-IN');
}
