import Select from '../../../components/ui/Select.jsx';
import { currentYear } from '../../../utils/dates.js';

export default function YearSelector({ value, years = [], onChange, id }) {
  const now = currentYear();
  const all = [...new Set([...years, now, now + 1, Number(value)])].sort((a, b) => b - a);
  // Fixed-width wrapper: Select is w-full by design, so its width comes from here.
  return (
    <div className="w-28 shrink-0">
      <Select id={id} aria-label="Año del programa" value={value} onChange={(e) => onChange(Number(e.target.value))} options={all.map((y) => ({ value: y, label: String(y) }))} />
    </div>
  );
}
