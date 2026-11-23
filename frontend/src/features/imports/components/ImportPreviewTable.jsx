import { STATUS_STYLE } from '../../../constants/statuses.js';
import { CATEGORIES } from '../../../constants/statuses.js';
import Select from '../../../components/ui/Select.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import es from '../../../i18n/es.js';

/**
 * Editable preview of the parsed definitions. Cells with a blocking issue are highlighted.
 * onUpdate(row, patch) sends one row fix to the API.
 */
export default function ImportPreviewTable({ definitions, issues, groups, users, onUpdate, disabled }) {
  const issueAt = (row, field) => issues.find((i) => i.row === row && i.field === field && i.blocking);
  const warn = (row, field) => (issueAt(row, field) ? 'ring-2 ring-danger/60 rounded-control' : '');
  const groupOptions = groups.map((g) => ({ value: g._id, label: g.name }));
  const userOptions = users.map((u) => ({ value: u._id, label: u.name }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1200px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-2 py-2">#</th>
            <th scope="col" className="px-2 py-2">Auditoría</th>
            <th scope="col" className="px-2 py-2 w-40">Tipo</th>
            <th scope="col" className="px-2 py-2 w-56">Requerido por</th>
            <th scope="col" className="px-2 py-2 w-52">Grupo responsable</th>
            <th scope="col" className="px-2 py-2 w-52">Responsable</th>
            <th scope="col" className="px-2 py-2">Meses</th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((d) => (
            <tr key={d.row} className={`border-b border-slate-100 align-top ${issues.some((i) => i.row === d.row && i.blocking) ? 'bg-red-50/40' : ''}`}>
              <td className={`px-2 py-2 font-semibold text-text-muted ${issueAt(d.row, 'code') ? 'text-danger' : ''}`}>{d.code}</td>
              <td className="px-2 py-2">
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-text-muted">
                  {d.standard} · Excel: {d.responsibleRaw}
                  {d.executor?.type === 'EXTERNAL' && <span className="ml-1 font-medium text-warning">(externo)</span>}
                </p>
                {d.ownerNamesRaw && <p className="text-xs text-text-faint">Nombres: {d.ownerNamesRaw}</p>}
              </td>
              <td className={`px-2 py-2 ${warn(d.row, 'category')}`}>
                <Select aria-label={`Tipo #${d.code}`} disabled={disabled} value={d.category ?? ''} placeholder="—" onChange={(e) => onUpdate(d.row, { category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c, label: es.categoriesShort[c] }))} />
              </td>
              <td className={`px-2 py-2 ${warn(d.row, 'requiredBy')}`}>
                <Input
                  aria-label={`Requerido por #${d.code}`}
                  disabled={disabled}
                  defaultValue={d.requiredBy.join(', ')}
                  placeholder={d.requiredBySuggestion?.join(', ') || 'Clientes separados por coma'}
                  onBlur={(e) => {
                    const list = e.target.value.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
                    if (list.length && list.join('|') !== d.requiredBy.join('|')) onUpdate(d.row, { requiredBy: list });
                  }}
                />
              </td>
              <td className={`px-2 py-2 ${warn(d.row, 'ownerGroupId')}`}>
                <Select aria-label={`Grupo #${d.code}`} disabled={disabled} value={d.ownerGroupId ?? ''} placeholder={d.ownerGroupName ? `¿${d.ownerGroupName}?` : 'Selecciona…'} onChange={(e) => e.target.value && onUpdate(d.row, { ownerGroupId: e.target.value })} options={groupOptions} />
              </td>
              <td className={`px-2 py-2 ${warn(d.row, 'defaultOwnerUserId')}`}>
                <Select aria-label={`Responsable #${d.code}`} disabled={disabled} value={d.defaultOwnerUserId ?? ''} placeholder="Selecciona…" onChange={(e) => e.target.value && onUpdate(d.row, { defaultOwnerUserId: e.target.value })} options={userOptions} />
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-1">
                  {d.occurrences.map((o) => (
                    <span key={o.month} title={`${es.monthsLong[o.month - 1]}: ${es.status[o.status]}`} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[o.status].cell} ${o.warnings?.length ? 'ring-2 ring-warning' : ''}`}>
                      {STATUS_STYLE[o.status].icon} {es.months[o.month - 1]}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
