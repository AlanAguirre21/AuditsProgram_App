export const CATEGORY = Object.freeze({
  SISTEMA_CALIDAD: 'SISTEMA_CALIDAD',
  CSR: 'CSR',
  PROCESOS: 'PROCESOS',
});
export const CATEGORIES = Object.values(CATEGORY);

export const EXECUTOR_TYPES = ['INTERNAL', 'EXTERNAL'];

/** Known external bodies (RESPONSABLE column). Matched case- and accent-insensitively. */
export const EXTERNAL_BODIES = ['DQS', 'SGS', 'TUV', 'BUREAU VERITAS'];
