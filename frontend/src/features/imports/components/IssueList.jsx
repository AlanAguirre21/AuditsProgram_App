import Badge from '../../../components/ui/Badge.jsx';

const LABELS = {
  OWNER_MISSING: 'Falta responsable',
  GROUP_NOT_FOUND: 'Grupo no encontrado',
  DUPLICATE_CODE: 'Número duplicado',
  CODE_EXISTS: 'Ya existe en el programa',
  REQUIRED_BY_EMPTY: '"Requerido por" vacío',
  REQUIRED_BY_GENERIC: '"Requerido por" genérico',
  CATEGORY_UNKNOWN: 'Tipo desconocido',
  STATUS_CONFLICT: 'Estado ambiguo',
  NO_OCCURRENCES: 'Sin meses',
  MONTH_COUNT_MISMATCH: 'Conteo mensual distinto',
};

const issueLabel = (code) => LABELS[code] ?? code;

function Section({ title, items, tone }) {
  return (
    items.length > 0 && (
      <div>
        <h3 className={`mb-2 text-sm font-semibold ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}>
          {title} ({items.length})
        </h3>
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-2 text-sm">
          {items.map((i, idx) => (
            <li key={`${i.row}-${i.code}-${i.field}-${idx}`} className="flex flex-wrap items-baseline gap-2">
              <Badge tone={tone}>{issueLabel(i.code)}</Badge>
              {i.defCode != null && <span className="font-semibold text-text-muted">#{i.defCode}</span>}
              <span>{i.message}</span>
              {i.suggestion && <span className="text-xs text-text-muted">(Excel: {Array.isArray(i.suggestion) ? i.suggestion.join(', ') : i.suggestion})</span>}
            </li>
          ))}
        </ul>
      </div>
    )
  );
}

/** Issues grouped as blocking (must be fixed) and warnings (informative). */
export default function IssueList({ issues }) {
  const blocking = issues.filter((i) => i.blocking);
  const warnings = issues.filter((i) => !i.blocking);
  if (!issues.length) return <p className="text-sm text-success">Sin problemas detectados.</p>;
  return (
    <div className="space-y-4">
      <Section title="Por resolver antes de confirmar" items={blocking} tone="danger" />
      <Section title="Avisos" items={warnings} tone="warning" />
    </div>
  );
}
