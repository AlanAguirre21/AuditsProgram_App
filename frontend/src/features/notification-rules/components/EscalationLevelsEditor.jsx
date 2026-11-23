import Button from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import { TARGETS } from '../targets.js';

/** value: [{ level, afterDaysOverdue, target }] — up to 3 levels, cumulative. */
export default function EscalationLevelsEditor({ value, onChange, disabled }) {
  const set = (i, patch) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = () => {
    const level = value.length + 1;
    onChange([...value, { level, afterDaysOverdue: (value.at(-1)?.afterDaysOverdue ?? 0) + 4, target: TARGETS[level - 1]?.value ?? 'QUALITY_SUPERVISOR' }]);
  };
  const remove = (i) => onChange(value.filter((_, j) => j !== i).map((l, j) => ({ ...l, level: j + 1 })));

  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={l.level} className="flex flex-wrap items-center gap-2 rounded-control bg-white/50 p-2">
          <span className="w-10 text-sm font-semibold text-zf-blue">N{l.level}</span>
          <span className="text-sm text-text-muted">a los</span>
          <Input aria-label={`Días de vencida para N${l.level}`} type="number" min={0} max={120} className="w-20" value={l.afterDaysOverdue} disabled={disabled} onChange={(e) => set(i, { afterDaysOverdue: Number(e.target.value) })} />
          <span className="text-sm text-text-muted">días de vencida →</span>
          <div className="min-w-56 flex-1">
            <Select aria-label={`Destinatario N${l.level}`} value={l.target} disabled={disabled} onChange={(e) => set(i, { target: e.target.value })} options={TARGETS} />
          </div>
          {i === value.length - 1 && (
            <Button size="sm" variant="ghost" onClick={() => remove(i)} disabled={disabled}>
              Quitar
            </Button>
          )}
        </div>
      ))}
      {value.length < 3 && (
        <Button size="sm" onClick={add} disabled={disabled}>
          + Agregar nivel
        </Button>
      )}
    </div>
  );
}
