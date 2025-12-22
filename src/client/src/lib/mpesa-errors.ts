/**
 * M-Pesa Result Code to User-Friendly Message Mapping
 * GAP-007: Provide specific M-Pesa error messages
 *
 * Reference: Safaricom Daraja API documentation
 */

/**
 * M-Pesa result codes and their user-friendly messages
 */
export const MPESA_RESULT_CODES: Record<string, string> = {
  // Success
  '0': 'Payment successful',

  // Common failure codes
  '1': 'Insufficient balance on your M-Pesa account. Please top up and try again.',
  '2001': 'Wrong PIN entered. Please try again with the correct PIN.',
  '2002': 'Payment cancelled by user',
  '17': 'The payment request was cancelled',
  '26': 'Payment timed out. Please check your M-Pesa messages for confirmation.',
  '1032': 'Payment request cancelled by user',
  '1037': 'Transaction timed out. Please try again.',

  // Additional error codes
  '1': 'Insufficient funds',
  '1025': 'The initiator does not have permission for the request',
  '1031': 'Transaction has been reversed',
  '1036': 'Insufficient balance in the wallet',
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
  if (code in MPESA_RESULT_CODES) {
    return MPESA_RESULT_CODES[code];
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
  return ['26', '1037', 'TIMEOUT'].includes(code);
}

/**
 * Check if the error is retryable
 */
export function isMpesaRetryable(resultCode: string | number | undefined): boolean {
  const code = String(resultCode);
  // User-cancelled, timeout, and some system errors are retryable
  return ['2002', '17', '1032', '26', '1037', 'TIMEOUT', '2006', 'SFC_IC0001'].includes(code);
}
