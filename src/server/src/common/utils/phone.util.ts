/**
 * Phone Number Utilities
 * Handles Kenyan phone number validation and formatting
 */

/**
 * Validates Kenyan phone number format
 * Accepts: 07xx, 01xx, +254xxx formats
 */
export function isValidKenyanPhone(phone: string): boolean {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');

  // Pattern for Kenyan mobile numbers
  // 07xxxxxxxx, 01xxxxxxxx, +2547xxxxxxxx, +2541xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx
  const kenyanMobileRegex = /^(?:\+?254|0)(7|1)\d{8}$/;

  return kenyanMobileRegex.test(cleaned);
}

/**
 * Normalizes phone number to E.164 format (+254...)
 * Per CLAUDE.md: Phone numbers stored in E.164 format internally
 */
export function normalizePhoneToE164(phone: string): string {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');

  // If already in +254 format
  if (cleaned.startsWith('+254')) {
    return cleaned;
  }

  // If in 254 format (without +)
  if (cleaned.startsWith('254')) {
    return `+${cleaned}`;
  }

  // If in 07xx or 01xx format
  if (cleaned.startsWith('0')) {
    return `+254${cleaned.slice(1)}`;
  }

  // Return as-is if doesn't match expected patterns
  return cleaned;
}

/**
 * Formats phone for display (last 4 digits visible)
 * Per CLAUDE.md PII masking requirements
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhoneToE164(phone);
  if (normalized.length < 4) {
    return '****';
  }
  return `***${normalized.slice(-4)}`;
}

/**
 * Formats phone for user display (readable format)
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneToE164(phone);

  // Format as +254 7XX XXX XXX
  if (normalized.length === 13) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
  }

  return normalized;
}
