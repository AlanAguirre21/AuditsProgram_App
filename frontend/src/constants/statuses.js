// Must match backend/src/constants/statuses.js
export const STATUS = Object.freeze({
  PROGRAMADA: 'PROGRAMADA',
  EN_VALIDACION: 'EN_VALIDACION',
  REALIZADA: 'REALIZADA',
  REALIZADA_FUERA_DE_TIEMPO: 'REALIZADA_FUERA_DE_TIEMPO',
  NO_REALIZADA: 'NO_REALIZADA',
  CANCELADA: 'CANCELADA',
});
export const STATUSES = Object.values(STATUS);
export const OPEN_STATUSES = [STATUS.PROGRAMADA, STATUS.EN_VALIDACION];
export const DONE_STATUSES = [STATUS.REALIZADA, STATUS.REALIZADA_FUERA_DE_TIEMPO];
export const DERIVED = Object.freeze({ VENCIDA: 'VENCIDA', PROXIMA: 'PROXIMA' });

export const CATEGORIES = ['SISTEMA_CALIDAD', 'CSR', 'PROCESOS'];

/**
 * Visual style per status, following the Excel legend (spec 6.1).
 * `icon` keeps the status readable without color (NFR-07).
 */
export const STATUS_STYLE = {
  PROGRAMADA: { cell: 'bg-slate-300/80 text-slate-700', badge: 'bg-slate-100 text-slate-700 ring-slate-300', icon: '●' },
  EN_VALIDACION: { cell: 'bg-yellow-300 text-yellow-900', badge: 'bg-yellow-50 text-yellow-800 ring-yellow-300', icon: '…' },
  REALIZADA: { cell: 'bg-green-500 text-white', badge: 'bg-green-50 text-green-800 ring-green-300', icon: '✓' },
  REALIZADA_FUERA_DE_TIEMPO: { cell: 'bg-orange-400 text-white', badge: 'bg-orange-50 text-orange-800 ring-orange-300', icon: '⏱' },
  NO_REALIZADA: { cell: 'bg-red-500 text-white', badge: 'bg-red-50 text-red-800 ring-red-300', icon: '✕' },
  CANCELADA: { cell: 'bg-slate-100 text-slate-400 line-through', badge: 'bg-slate-50 text-slate-500 ring-slate-200 line-through', icon: '⊘' },
};
