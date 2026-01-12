// Centralized error wrapper for all services
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export function handleServiceError(error: any, context?: string): ServiceError {
  let code = 'unknown';
  let message = 'An unexpected error occurred.';
  let details = undefined;

  if (error && typeof error === 'object') {
    if (error.code) code = error.code;
    if (error.message) message = error.message;
    details = error.details || error.stack || error;
  } else if (typeof error === 'string') {
    message = error;
  }

  if (context) {
    message = `[${context}] ${message}`;
  }

  return { code, message, details };
}
