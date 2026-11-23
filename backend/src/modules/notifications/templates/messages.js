/**
 * Message content per notification type (spec 8.5), independent of the output format.
 * Rendered as a Teams Adaptive Card (adaptiveCard.js) and as an optional email (email.js).
 */
import { NOTIFICATION_TYPE as T } from '../../../constants/notifications.js';
import { formatDateMx } from '../../../utils/dates.js';

export const SUBJECT_PREFIX = '[Programa de Auditorías]';

const STATUS_ES = {
  PROGRAMADA: 'Programada',
  EN_VALIDACION: 'En validación',
  REALIZADA: 'Realizada',
  REALIZADA_FUERA_DE_TIEMPO: 'Realizada fuera de tiempo',
  NO_REALIZADA: 'No realizada',
  CANCELADA: 'Cancelada',
};
const LEVEL_ES = { 1: 'N1 · Jefe directo', 2: 'N2 · Supervisor de calidad', 3: 'N3 · Gerente de calidad de planta' };

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function daysPhrase(daysToDue) {
  if (daysToDue == null) return '';
  if (daysToDue === 0) return 'Vence hoy';
  if (daysToDue > 0) return `Faltan ${plural(daysToDue, 'día')}`;
  return `Vencida hace ${plural(-daysToDue, 'día')}`;
}

const auditLabel = (occ) => {
  const d = occ.definitionId ?? {};
  return `${d.standard ? `${d.standard} ` : ''}${d.name ?? ''}`.trim();
};

function occurrenceFacts(occ, daysToDue) {
  const d = occ.definitionId ?? {};
  const facts = [
    ['Auditoría', `#${d.code} ${d.name}`],
    ['Norma / requerimiento', d.standard],
    ['Requerido por', (d.requiredBy ?? []).join(', ')],
    ['Fecha límite', formatDateMx(occ.dueDate)],
  ];
  if (daysToDue != null) facts.push(['Situación', daysPhrase(daysToDue)]);
  facts.push(['Responsable', occ.ownerUserId?.name ?? '—']);
  facts.push(['Grupo', occ.ownerGroupId?.name ?? '—']);
  facts.push(['Nivel de escalación', occ.lastEscalationLevel ? LEVEL_ES[occ.lastEscalationLevel] : 'Sin escalar']);
  return facts.filter(([, v]) => v);
}

/**
 * @param type   NOTIFICATION_TYPE
 * @param data   { occ, daysToDue, level, link, comment, approved, requestedDate, reason,
 *                 escalationHistory[], occurrences[] (REASSIGNED), digest (DIGEST), recipientName }
 * @returns { subject, title, summary, facts[], sections[], link, linkLabel, tone }
 */
export function buildMessage(type, data) {
  const { occ, daysToDue, link } = data;
  const due = occ ? formatDateMx(occ.dueDate) : '';
  const base = { link, linkLabel: 'Ver auditoría', facts: occ ? occurrenceFacts(occ, daysToDue) : [], sections: [] };

  switch (type) {
    case T.REMINDER:
      return {
        ...base,
        tone: 'accent',
        subject: `${SUBJECT_PREFIX} Recordatorio: ${auditLabel(occ)} — vence ${due}`,
        title: 'Recordatorio de auditoría',
        summary: `Tienes una auditoría programada. ${daysPhrase(daysToDue)}. Cuando la realices, regístrala con su evidencia.`,
      };
    case T.DUE_TODAY:
      return {
        ...base,
        tone: 'warning',
        subject: `${SUBJECT_PREFIX} Vence hoy: ${auditLabel(occ)} — ${due}`,
        title: 'La auditoría vence hoy',
        summary: daysToDue > 0 ? `La fecha límite (${due}) es un día no laborable: hoy es el último día hábil.` : 'Hoy es la fecha límite. Si ya la realizaste, regístrala con su evidencia.',
      };
    case T.OVERDUE:
      return {
        ...base,
        tone: 'attention',
        subject: `${SUBJECT_PREFIX} Vencida: ${auditLabel(occ)} — ${daysPhrase(daysToDue).toLowerCase()}`,
        title: 'Auditoría vencida',
        summary: `La auditoría no se ha registrado como realizada. ${daysPhrase(daysToDue)}. Regístrala o solicita una reprogramación.`,
      };
    case T.ESCALATION: {
      const history = data.escalationHistory ?? [];
      return {
        ...base,
        tone: 'attention',
        subject: `${SUBJECT_PREFIX} Escalación ${LEVEL_ES[data.level]?.split(' · ')[0] ?? ''}: ${auditLabel(occ)} — ${daysPhrase(daysToDue).toLowerCase()}`,
        title: `Escalación ${LEVEL_ES[data.level] ?? ''}`,
        summary: `La auditoría a cargo de ${occ.ownerUserId?.name ?? 'el responsable'} sigue sin realizarse. ${daysPhrase(daysToDue)}.`,
        sections: history.length ? [{ title: 'Historial de escalación', items: history.map((h) => `${LEVEL_ES[h.level]} — ${formatDateMx(h.at)} — ${h.to}`) }] : [],
      };
    }
    case T.VALIDATION_REQUEST:
      return {
        ...base,
        tone: 'accent',
        subject: `${SUBJECT_PREFIX} Por validar: ${auditLabel(occ)}`,
        title: 'Auditoría registrada, pendiente de validación',
        summary: `${occ.completion?.submittedBy?.name ?? occ.ownerUserId?.name ?? 'El responsable'} registró la auditoría como realizada el ${formatDateMx(occ.completion?.performedAt)}. Revisa la evidencia y valídala o recházala.`,
        linkLabel: 'Revisar y validar',
      };
    case T.VALIDATION_RESULT:
      return {
        ...base,
        tone: data.approved ? 'good' : 'attention',
        subject: `${SUBJECT_PREFIX} ${data.approved ? 'Validada' : 'Rechazada'}: ${auditLabel(occ)}`,
        title: data.approved ? 'Auditoría validada' : 'Registro rechazado',
        summary: data.approved
          ? `Calidad validó tu registro. Estado final: ${STATUS_ES[occ.status] ?? occ.status}.`
          : `Calidad rechazó el registro y la auditoría regresó a Programada. Comentario: “${data.comment}”`,
      };
    case T.RESCHEDULE_REQUEST:
      return {
        ...base,
        tone: 'accent',
        subject: `${SUBJECT_PREFIX} Solicitud de reprogramación: ${auditLabel(occ)}`,
        title: 'Solicitud de reprogramación',
        summary: `${occ.rescheduleRequest?.requestedBy?.name ?? 'El responsable'} solicita mover la fecha del ${due} al ${formatDateMx(data.requestedDate)}. Motivo: “${data.reason}”`,
        linkLabel: 'Aprobar o rechazar',
      };
    case T.RESCHEDULE_RESULT:
      return {
        ...base,
        tone: data.approved ? 'good' : 'attention',
        subject: `${SUBJECT_PREFIX} Reprogramación ${data.approved ? 'aprobada' : 'rechazada'}: ${auditLabel(occ)}`,
        title: data.approved ? 'Reprogramación aprobada' : 'Reprogramación rechazada',
        summary: data.approved ? `La nueva fecha límite es ${due}.` : `La fecha se mantiene (${due}). Comentario: “${data.comment}”`,
      };
    case T.REASSIGNED: {
      const list = data.occurrences ?? [];
      return {
        link,
        linkLabel: list.length === 1 ? 'Ver auditoría' : 'Ver mis auditorías',
        tone: 'accent',
        subject: `${SUBJECT_PREFIX} Se te asignaron ${plural(list.length, 'auditoría')}`,
        title: 'Nuevas auditorías a tu cargo',
        summary: `Ahora eres responsable de ${plural(list.length, 'auditoría')}.${data.reason ? ` Motivo: “${data.reason}”` : ''}`,
        facts: [],
        sections: [{ title: 'Auditorías', items: list.map((o) => `#${o.definitionId?.code} ${o.definitionId?.name} — vence ${formatDateMx(o.dueDate)}`) }],
      };
    }
    case T.DIGEST:
      return buildDigest(data);
    case T.TEST:
    default:
      return {
        link,
        linkLabel: 'Abrir la aplicación',
        tone: 'good',
        facts: [],
        sections: [],
        subject: `${SUBJECT_PREFIX} Mensaje de prueba`,
        title: 'Mensaje de prueba',
        summary: `Hola ${data.recipientName ?? ''}. Si ves este mensaje, las notificaciones por Teams funcionan.`,
      };
  }
}

function buildDigest({ digest, link }) {
  const pct = (v) => (v == null ? 'N/A' : `${v}%`);
  const line = (o) => `#${o.definitionId?.code} ${o.definitionId?.name} — ${o.ownerUserId?.name ?? ''} — ${formatDateMx(o.dueDate)}`;
  const sections = [];
  for (const level of [3, 2, 1, 0]) {
    const items = digest.overdueByLevel[level] ?? [];
    if (items.length) sections.push({ title: `Vencidas · ${level ? LEVEL_ES[level] : 'sin escalar'} (${items.length})`, items: items.map(line) });
  }
  sections.push({ title: `Próximas 14 días (${digest.upcoming.length})`, items: digest.upcoming.map(line) });
  if (digest.pendingValidations.length) sections.push({ title: `Por validar (${digest.pendingValidations.length})`, items: digest.pendingValidations.map(line) });
  if (digest.pendingReschedules.length) sections.push({ title: `Reprogramaciones pendientes (${digest.pendingReschedules.length})`, items: digest.pendingReschedules.map(line) });
  if (digest.failedNotifications) sections.push({ title: 'Notificaciones fallidas (7 días)', items: [`${digest.failedNotifications} envío(s) fallaron. Revisa la bitácora de notificaciones.`] });
  if (digest.inactiveOwners.length) sections.push({ title: 'Usuarios inactivos con auditorías abiertas', items: digest.inactiveOwners.map((u) => `${u.name} — ${u.count}`) });
  const overdueTotal = Object.values(digest.overdueByLevel).reduce((n, l) => n + l.length, 0);
  return {
    link,
    linkLabel: 'Abrir el programa',
    tone: overdueTotal ? 'attention' : 'good',
    subject: `${SUBJECT_PREFIX} Resumen semanal — ${formatDateMx(digest.today)}`,
    title: 'Resumen semanal del programa de auditorías',
    summary: `${overdueTotal} vencida(s), ${digest.upcoming.length} próxima(s), ${digest.pendingValidations.length} por validar.`,
    facts: [
      [`Cumplimiento ${digest.year} (a tiempo)`, pct(digest.ytd.onTime)],
      [`Cumplimiento ${digest.year} (total)`, pct(digest.ytd.total)],
      ['Cumplimiento del mes (a tiempo)', pct(digest.month.onTime)],
    ],
    sections,
  };
}
