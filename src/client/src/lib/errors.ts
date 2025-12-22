/**
 * Custom error classes for BodaInsure client
 * Per implementation plan GAP-001: Add 403 handling differentiation
 */

/**
 * PermissionError - thrown when user lacks permission for an action (403)
 * Unlike 401 (which logs out), 403 shows a clear permission message
 */
export class PermissionError extends Error {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * ValidationError - for displaying field-specific validation errors
 * Per implementation plan GAP-002: Extract validation field details
 */
export interface ValidationDetail {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  public details: ValidationDetail[];

  constructor(message: string, details: ValidationDetail[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }

  /**
   * Format validation errors for display
   * Returns multi-line string with field: message format
   */
  formatForDisplay(): string {
    if (this.details.length === 0) {
      return this.message;
    }
    return this.details
      .map(d => d.field !== 'unknown' ? `${d.field}: ${d.message}` : d.message)
      .join('\n');
  }
}

/**
 * Check if an error is a PermissionError
 */
export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError ||
    (error instanceof Error && error.name === 'PermissionError');
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError ||
    (error instanceof Error && error.name === 'ValidationError');
}
