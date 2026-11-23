import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof ZodError) {
    error = AppError.badRequest('Datos inválidos', { issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  } else if (err instanceof multer.MulterError) {
    error =
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError(413, 'PAYLOAD_TOO_LARGE', 'El archivo excede el tamaño máximo permitido')
        : AppError.badRequest(`Error al subir archivo: ${err.message}`);
  } else if (err instanceof mongoose.Error.CastError) {
    error = AppError.badRequest(`Identificador inválido: ${err.value}`);
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = AppError.badRequest('Datos inválidos', {
      issues: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    });
  } else if (err?.code === 11000) {
    error = AppError.duplicate('Ya existe un registro con esos datos', { keyValue: err.keyValue });
  } else if (err?.type === 'entity.too.large') {
    error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande');
  } else if (err?.type === 'entity.parse.failed') {
    error = AppError.badRequest('JSON inválido');
  }

  if (!(error instanceof AppError)) {
    logger.error({ err, path: req.path }, 'Unhandled error');
    // The logger is silent under tests; never hide unexpected errors there.
    if (env.isTest) console.error(err);
    error = new AppError(500, 'INTERNAL_ERROR', 'Error interno del servidor');
  } else if (error.status >= 500) {
    logger.error({ err, path: req.path }, error.message);
  }

  res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details ?? {} } });
}
