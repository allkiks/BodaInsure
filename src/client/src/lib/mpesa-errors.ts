/**
 * M-Pesa Result Code to User-Friendly Message Mapping
 * Aligned with backend mpesa.errors.ts
 *
 * Reference: Safaricom Daraja API documentation
 */

/**
 * M-Pesa Error Code enum - matches backend MpesaErrorCode
 */
export enum MpesaErrorCode {
  // Success
  SUCCESS = '0',

  // User-side errors (1xxx)
  CANCELLED_BY_USER = '1032',
  INSUFFICIENT_BALANCE = '1',
  WRONG_PIN = '2001',
  DAILY_LIMIT_EXCEEDED = '1025',
  DUPLICATE_TRANSACTION = '1037',
  TRANSACTION_TIMEOUT = '1036',

  // System errors (5xx/service)
  SERVICE_UNAVAILABLE = '503',
  INTERNAL_ERROR = '500',
  BAD_REQUEST = '400',

  // Authentication errors
  INVALID_CREDENTIALS = '401',
  TOKEN_EXPIRED = '40001',
}

/**
 * M-Pesa result codes and their user-friendly messages
 */
export const MPESA_RESULT_CODES: Record<string, string> = {
  // Success
  [MpesaErrorCode.SUCCESS]: 'Payment successful',

  // User-side errors
  [MpesaErrorCode.CANCELLED_BY_USER]: 'You cancelled the payment request',
  [MpesaErrorCode.INSUFFICIENT_BALANCE]: 'Your M-Pesa balance is insufficient. Please top up and try again.',
  [MpesaErrorCode.WRONG_PIN]: 'Wrong M-Pesa PIN entered. Please try again with the correct PIN.',
  [MpesaErrorCode.DAILY_LIMIT_EXCEEDED]: 'Your daily M-Pesa limit has been exceeded. Try again tomorrow.',
  [MpesaErrorCode.DUPLICATE_TRANSACTION]: 'A similar transaction is already being processed. Please wait.',
  [MpesaErrorCode.TRANSACTION_TIMEOUT]: 'The payment request timed out. Please try again.',

  // System errors
  [MpesaErrorCode.SERVICE_UNAVAILABLE]: 'M-Pesa service is temporarily unavailable. Please try again later.',
  [MpesaErrorCode.INTERNAL_ERROR]: 'An error occurred with M-Pesa. Please try again.',
  [MpesaErrorCode.BAD_REQUEST]: 'Invalid payment request. Please check your details.',
  [MpesaErrorCode.INVALID_CREDENTIALS]: 'Payment service authentication failed. Please contact support.',
  [MpesaErrorCode.TOKEN_EXPIRED]: 'Payment session expired. Please try again.',

  // Legacy codes for backward compatibility
  '2002': 'Payment cancelled by user',
  '17': 'The payment request was cancelled',
  '26': 'Payment timed out. Please check your M-Pesa messages for confirmation.',
  '1031': 'Transaction has been reversed',
  '2006': 'Unable to process request. Please try again later.',

  // System errors
  'SFC_IC0001': 'System error. Please try again later.',
  'SFC_IC0003': 'Invalid phone number format',

  // Timeout-related
  'TIMEOUT': 'Payment timed out. Please check your M-Pesa messages or try again.',
  'PENDING': 'Payment is still being processed. Please wait.',
};

/**
 * Get a user-friendly error message for an M-Pesa result code
 * @param resultCode - The M-Pesa result code
 * @returns User-friendly error message
 */
export function getMpesaErrorMessage(resultCode: string | number | undefined): string {
  if (resultCode === undefined || resultCode === null) {
    return 'Payment status unknown. Please check your M-Pesa messages.';
  }

  const code = String(resultCode);

  // Check for known codes
  const message = MPESA_RESULT_CODES[code];
  if (message !== undefined) {
    return message;
  }

  // Generic message for unknown codes
  return `Payment failed (Code: ${code}). Please try again or contact support.`;
}

/**
 * Check if a result code indicates success
 */
export function isMpesaSuccess(resultCode: string | number | undefined): boolean {
  return String(resultCode) === '0';
}

/**
 * Check if a result code indicates a user-cancelled transaction
 */
export function isMpesaCancelled(resultCode: string | number | undefined): boolean {
  const code = String(resultCode);
  return ['2002', '17', '1032'].includes(code);
}

/**
 * Check if a result code indicates a timeout
 */
export function isMpesaTimeout(resultCode: string | number | undefined): boolean {
  const code = String(resultCode);
  return [
    '26',
    MpesaErrorCode.TRANSACTION_TIMEOUT,
    MpesaErrorCode.DUPLICATE_TRANSACTION,
    'TIMEOUT',
  ].includes(code);
}

/**
 * Check if the error is retryable
 */
export function isMpesaRetryable(resultCode: string | number | undefined): boolean {
  const code = String(resultCode);
  return [
    // User-cancelled (can try again)
    MpesaErrorCode.CANCELLED_BY_USER,
    '2002',
    '17',
    // Timeout errors
    MpesaErrorCode.TRANSACTION_TIMEOUT,
    '26',
    'TIMEOUT',
    // Transient system errors
    MpesaErrorCode.SERVICE_UNAVAILABLE,
    MpesaErrorCode.INTERNAL_ERROR,
    MpesaErrorCode.TOKEN_EXPIRED,
    '2006',
    'SFC_IC0001',
  ].includes(code);
}

/**
 * Check if the error is a user-side error (not system fault)
 * These don't require contacting support
 */
export function isMpesaUserError(resultCode: string | number | undefined): boolean {
  const code = String(resultCode);
  return [
    MpesaErrorCode.CANCELLED_BY_USER,
    MpesaErrorCode.INSUFFICIENT_BALANCE,
    MpesaErrorCode.WRONG_PIN,
    MpesaErrorCode.DAILY_LIMIT_EXCEEDED,
    '2002',
    '17',
  ].includes(code);
}

/**
 * Get guidance text for specific error scenarios
 */
export function getMpesaErrorGuidance(resultCode: string | number | undefined): string | null {
  const code = String(resultCode);

  if (isMpesaTimeout(code)) {
    return 'Your payment may still be processing. Use "Check Status" to verify, or check your M-Pesa messages.';
  }

  if (code === MpesaErrorCode.INSUFFICIENT_BALANCE || code === '1') {
    return 'Please top up your M-Pesa account and try again.';
  }

  if (code === MpesaErrorCode.WRONG_PIN || code === '2001') {
    return 'Please ensure you enter the correct M-Pesa PIN next time.';
  }

  if (code === MpesaErrorCode.DAILY_LIMIT_EXCEEDED) {
    return 'You have reached your daily M-Pesa transaction limit. Try again tomorrow.';
  }

  if (isMpesaCancelled(code)) {
    return 'You cancelled the payment. You can try again when ready.';
  }

  return null;
}
