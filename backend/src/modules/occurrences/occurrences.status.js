import { AppError } from '../../utils/AppError.js';

/** Single source of truth for occurrence status transitions (spec 6.3). */
export const TRANSITIONS = {
  PROGRAMADA: ['EN_VALIDACION', 'REALIZADA', 'REALIZADA_FUERA_DE_TIEMPO', 'NO_REALIZADA', 'CANCELADA', 'PROGRAMADA'],
  EN_VALIDACION: ['REALIZADA', 'REALIZADA_FUERA_DE_TIEMPO', 'PROGRAMADA'],
  REALIZADA: [],
  REALIZADA_FUERA_DE_TIEMPO: [],
  NO_REALIZADA: [],
  CANCELADA: [],
};

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

const LABEL = {
  PROGRAMADA: 'PROGRAMADA',
  EN_VALIDACION: 'EN VALIDACIÓN',
  REALIZADA: 'REALIZADA',
  REALIZADA_FUERA_DE_TIEMPO: 'REALIZADA FUERA DE TIEMPO',
  NO_REALIZADA: 'NO REALIZADA',
  CANCELADA: 'CANCELADA',
};

export function assertTransition(from, to, actionLabel = 'realizar esta acción') {
  if (!canTransition(from, to)) {
    throw AppError.invalidTransition(`No se puede ${actionLabel} en una auditoría en estado ${LABEL[from] ?? from}`, { from, to });
  }
}
