export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthenticated(message = 'Sesión no válida o expirada') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'No tienes permiso para realizar esta acción') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Recurso no encontrado') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message, details) {
    return new AppError(409, 'CONFLICT', message, details);
  }
  static duplicate(message, details) {
    return new AppError(409, 'DUPLICATE', message, details);
  }
  static invalidTransition(message, details) {
    return new AppError(409, 'INVALID_TRANSITION', message, details);
  }
  static tooMany(message = 'Demasiados intentos. Intenta más tarde.') {
    return new AppError(429, 'TOO_MANY_REQUESTS', message);
  }
}
