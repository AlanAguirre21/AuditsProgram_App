import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/** Allowed evidence types: extension → accepted MIME types (spec 14.5). */
export const EVIDENCE_TYPES = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', 'application/zip'],
  xls: ['application/vnd.ms-excel', 'application/octet-stream'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', 'application/zip'],
  doc: ['application/msword', 'application/octet-stream'],
  msg: ['application/vnd.ms-outlook', 'application/octet-stream'],
};

export const MAX_FILES_PER_REQUEST = 10;
export const MAX_FILES_PER_OCCURRENCE = 30;

const extOf = (name) => path.extname(name || '').slice(1).toLowerCase();

const evidenceFilter = (_req, file, cb) => {
  const allowed = EVIDENCE_TYPES[extOf(file.originalname)];
  if (!allowed || !allowed.includes(file.mimetype)) {
    return cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', `Tipo de archivo no permitido: ${file.originalname}`));
  }
  cb(null, true);
};

export const uploadEvidence = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes, files: MAX_FILES_PER_REQUEST },
  fileFilter: evidenceFilter,
}).array('files', MAX_FILES_PER_REQUEST);

const excelFilter = (_req, file, cb) => {
  if (extOf(file.originalname) !== 'xlsx') {
    return cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Solo se aceptan archivos .xlsx'));
  }
  cb(null, true);
};

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: excelFilter,
}).single('file');

export { extOf };
