/**
 * Correlation ID constants used across the application.
 * The actual correlation ID logic is applied directly in server.ts
 * using genReqId and onRequest hook to avoid encapsulation issues.
 */
export const CORRELATION_ID_HEADER = 'x-request-id';
