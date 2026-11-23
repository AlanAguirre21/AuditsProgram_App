import es from '../../../i18n/es.js';

/** Toggle buttons for the 12 months. value: number[] (1-12). */
export default function MonthPicker({ value = [], onChange, year, disabledMonths = [] }) {
  const toggle = (m) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b));
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12" role="group" aria-label="Meses programados">
      {es.months.map((label, i) => {
        const m = i + 1;
        const on = value.includes(m);
        const disabled = disabledMonths.includes(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(m)}
            title={disabled ? 'Ya existe una fecha en este mes' : undefined}
            className={`rounded-control border px-2 py-2 text-xs font-medium capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40
              ${on ? 'border-accent bg-accent text-white shadow-md shadow-accent/25' : 'border-white/60 bg-white/60 text-text hover:bg-white'}`}
          >
            {label}
            {year ? `-${String(year).slice(-2)}` : ''}
          </button>
        );
      })}
    </div>
  );
}
