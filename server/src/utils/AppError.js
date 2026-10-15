// Errors return { error: { code, message } } (SRS 4.2)
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'invalid_input', message, details);
export const unauthorized = (message = 'Please log in to continue.') => new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You are not allowed to do that.') => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'not_found', message);
export const conflict = (message, details) => new AppError(409, 'conflict', message, details);
