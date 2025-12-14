/**
 * PII Masking Utilities
 * Per CLAUDE.md Section 6.2 PII Classification requirements
 */

/**
 * Masks National ID - shows last 4 only
 * Classification: HIGH
 */
export function maskNationalId(nationalId: string): string {
  if (!nationalId || nationalId.length < 4) {
    return '****';
  }
  return `****${nationalId.slice(-4)}`;
}

/**
 * Masks KRA PIN - shows last 4 only
 * Classification: HIGH
 */
export function maskKraPin(kraPin: string): string {
  if (!kraPin || kraPin.length < 4) {
    return '****';
  }
  return `****${kraPin.slice(-4)}`;
}

/**
 * Masks email - shows first 3 chars + domain
 * Classification: MEDIUM
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***@***.***';
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return '***@***.***';
  }

  const maskedLocal =
    localPart.length > 3 ? `${localPart.slice(0, 3)}***` : '***';

  return `${maskedLocal}@${domain}`;
}

/**
 * Masks full name - shows first name + initial
 * Classification: MEDIUM
 */
export function maskFullName(fullName: string): string {
  if (!fullName) {
    return '***';
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    return '***';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1]?.charAt(0) ?? '';

  return `${firstName} ${lastInitial}.`;
}

/**
 * Masks date of birth - shows year only
 * Classification: MEDIUM
 */
export function maskDateOfBirth(dob: Date | string): string {
  try {
    const date = typeof dob === 'string' ? new Date(dob) : dob;
    return `****-**-** (${date.getFullYear()})`;
  } catch {
    return '****-**-**';
  }
}

/**
 * Generic PII masking based on field type
 */
export type PiiFieldType =
  | 'national_id'
  | 'kra_pin'
  | 'phone'
  | 'email'
  | 'full_name'
  | 'date_of_birth';

export function maskPii(value: string, fieldType: PiiFieldType): string {
  switch (fieldType) {
    case 'national_id':
      return maskNationalId(value);
    case 'kra_pin':
      return maskKraPin(value);
    case 'email':
      return maskEmail(value);
    case 'full_name':
      return maskFullName(value);
    case 'date_of_birth':
      return maskDateOfBirth(value);
    case 'phone':
      // Import from phone.util to avoid circular deps
      if (!value || value.length < 4) return '****';
      return `***${value.slice(-4)}`;
    default:
      return '***';
  }
}
