/** tabs: [{ value, label, count? }] */
export default function Tabs({ tabs, value, onChange, label = 'Secciones' }) {
  return (
    <div role="tablist" aria-label={label} className="neu-inset inline-flex max-w-full overflow-x-auto rounded-full bg-white/40 p-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
              ${active ? 'bg-white text-zf-blue shadow-sm' : 'text-text-muted hover:text-text'}`}
          >
            {t.label}
            {t.count != null && (
              <span className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] ${active ? 'bg-accent text-white' : 'bg-slate-200 text-slate-600'}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
