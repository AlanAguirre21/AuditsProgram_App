import { AppError } from '../utils/AppError.js';

export const notFound = (req, _res, next) => next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
