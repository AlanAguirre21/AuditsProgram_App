export const TARGETS = [
  { value: 'MANAGER', label: 'Jefe directo (o contacto del grupo)' },
  { value: 'QUALITY_SUPERVISOR', label: 'Supervisores de calidad' },
  { value: 'PLANT_QUALITY_MANAGER', label: 'Gerente de calidad de planta' },
];

export const NOTIFICATION_TYPE_ES = {
  REMINDER: 'Recordatorio',
  DUE_TODAY: 'Vence hoy',
  OVERDUE: 'Vencida',
  ESCALATION: 'Escalación',
  DIGEST: 'Resumen semanal',
  VALIDATION_REQUEST: 'Solicitud de validación',
  VALIDATION_RESULT: 'Resultado de validación',
  RESCHEDULE_REQUEST: 'Solicitud de reprogramación',
  RESCHEDULE_RESULT: 'Resultado de reprogramación',
  REASSIGNED: 'Reasignación',
  TEST: 'Prueba',
};

export const CHANNEL_ES = { TEAMS_CHAT: 'Chat de Teams', TEAMS_CHANNEL: 'Canal de Calidad', EMAIL: 'Correo' };
