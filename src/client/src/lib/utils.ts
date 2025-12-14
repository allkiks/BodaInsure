import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Masks a phone number for display (e.g., 0712***678)
 * Per CLAUDE.md PII masking requirements
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 10) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)}***${cleaned.slice(-3)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return `0${cleaned.slice(3, 6)}***${cleaned.slice(-3)}`;
  }
  return phone;
}

/**
 * Masks a national ID for display (shows last 4 only)
 * Per CLAUDE.md PII masking requirements
 */
export function maskNationalId(id: string): string {
  if (!id || id.length < 4) return id;
  return `***${id.slice(-4)}`;
}

/**
 * Formats currency in KES
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Formats a date with time for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
