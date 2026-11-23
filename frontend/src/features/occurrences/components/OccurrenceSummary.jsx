import Alert from '../../../components/ui/Alert.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import StatusBadge from '../../../components/StatusBadge.jsx';
import es from '../../../i18n/es.js';
import { daysText, formatDate, formatDateTime } from '../../../utils/dates.js';

function Item({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children || '—'}</dd>
    </div>
  );
}

export default function OccurrenceSummary({ occ }) {
  const def = occ.definitionId;
  const c = occ.completion;
  const rr = occ.rescheduleRequest;
  const rejections = occ.validation?.rejections ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={occ.status} derived={occ.derived} />
        {occ.status === 'PROGRAMADA' && <span className={`text-sm font-medium ${occ.daysToDue < 0 ? 'text-danger' : 'text-text-muted'}`}>{daysText(occ.daysToDue)}</span>}
        {occ.rescheduled && <Badge tone="accent">↻ Reprogramada</Badge>}
        {occ.evaluateAgainstOriginal && <Badge tone="warning">Se evalúa contra la fecha original</Badge>}
      </div>

      {rr?.status === 'PENDING' && (
        <Alert tone="warning" title="Reprogramación pendiente de aprobación">
          Nueva fecha solicitada: <strong>{formatDate(rr.requestedDate)}</strong> por {rr.requestedBy?.name}. Motivo: {rr.reason}
        </Alert>
      )}
      {rr?.status === 'REJECTED' && rr.resolutionComment && occ.status === 'PROGRAMADA' && (
        <Alert tone="danger" title="Última solicitud de reprogramación rechazada">{rr.resolutionComment}</Alert>
      )}
      {occ.status === 'PROGRAMADA' && rejections.length > 0 && (
        <Alert tone="danger" title="El registro fue rechazado por Calidad">
          {rejections.at(-1).comment} — {rejections.at(-1).by?.name}, {formatDateTime(rejections.at(-1).at)}
        </Alert>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Tipo">{es.categoriesShort[def.category]}</Item>
        <Item label="Norma / requerimiento">{def.standard}</Item>
        <Item label="Requerido por">{def.requiredBy?.join(', ')}</Item>
        <Item label="Fecha programada">{formatDate(occ.dueDate)}</Item>
        <Item label="Fecha original">{formatDate(occ.originalDueDate)}</Item>
        <Item label="Ejecuta">
          {def.executor?.name} <span className="text-text-muted">({es.executor[def.executor?.type]})</span>
        </Item>
        <Item label="Responsable">{occ.ownerUserId?.name}</Item>
        <Item label="Grupo responsable">{occ.ownerGroupId?.name}</Item>
        <Item label="Evidencia / validación">
          {def.evidenceRequired ? 'Evidencia obligatoria' : 'Evidencia opcional'} · {def.requiresValidation ? 'Requiere validación' : 'Sin validación'}
        </Item>
        {def.folderPath && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Item label="Carpeta de documentos">
              <span className="break-all font-mono text-xs">{def.folderPath}</span>
            </Item>
          </div>
        )}
      </dl>

      {c?.performedAt && (
        <div className="rounded-control border border-white/70 bg-white/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zf-blue">Registro de realización</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Realizada el">{formatDate(c.performedAt)}</Item>
            <Item label="Registrada por">{c.importedCompletion ? 'Importada del Excel' : `${c.submittedBy?.name ?? ''} · ${formatDateTime(c.submittedAt)}`}</Item>
            <Item label="Hallazgos">
              {c.findings ? `${c.findings.major} mayores · ${c.findings.minor} menores · ${c.findings.observations} obs.` : '—'}
            </Item>
            <Item label="Referencia externa">{c.externalRef}</Item>
            {c.findingsSummary && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Item label="Resumen de hallazgos">
                  <span className="whitespace-pre-line">{c.findingsSummary}</span>
                </Item>
              </div>
            )}
            {occ.validation?.validatedAt && (
              <Item label="Validada por">
                {occ.validation.validatedBy?.name} · {formatDateTime(occ.validation.validatedAt)}
                {occ.validation.selfValidated && <Badge tone="warning" className="ml-1">Auto-validada</Badge>}
              </Item>
            )}
          </dl>
        </div>
      )}

      {occ.closure?.reason && (
        <Alert tone={occ.status === 'CANCELADA' ? 'info' : 'danger'} title={es.status[occ.status]}>
          {occ.closure.reason} — {occ.closure.closedBy?.name}, {formatDateTime(occ.closure.closedAt)}
        </Alert>
      )}
    </div>
  );
}
