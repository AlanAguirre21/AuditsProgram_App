import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Categorical slots 1–2 of the validated reference palette, in fixed order. */
const SERIES = [
  { key: 'onTime', name: 'A tiempo', color: '#2a78d6' },
  { key: 'total', name: 'Total (incluye fuera de tiempo)', color: '#eb6834' },
];
const INK = { primary: '#1d1d1f', secondary: '#6e6e73', grid: '#e5e5ea' };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold capitalize text-text">{label}</p>
      {row.exigibles === 0 ? (
        <p className="text-text-muted">N/A · nada exigible todavía ({row.programadas} programadas)</p>
      ) : (
        <>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-2 text-text">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.name}: <strong>{row[s.key]}%</strong>
            </p>
          ))}
          <p className="mt-1 text-text-muted">
            {row.aTiempo} a tiempo · {row.fueraDeTiempo} fuera de tiempo · {row.exigibles} exigibles
          </p>
        </>
      )}
    </div>
  );
}

/** N/A months show a label at the baseline instead of an empty gap (spec 7.6: never 0%). */
const NaLabel = ({ x, y, width, value }) =>
  value == null ? (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fill={INK.secondary}>
      N/A
    </text>
  ) : null;

export default function ComplianceByMonthChart({ rows }) {
  const data = rows.map((r) => ({ ...r, onTimeBar: r.onTime ?? 0, totalBar: r.total ?? 0, label: r.label }));
  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-text-muted" aria-label="Leyenda">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
      <div className="h-72 w-full" role="img" aria-label="Cumplimiento por mes; el detalle está en la tabla">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: INK.grid }} tick={{ fontSize: 11, fill: INK.secondary }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: INK.secondary }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,87,183,0.06)' }} />
            <Bar dataKey="onTimeBar" name="A tiempo" fill={SERIES[0].color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
              <LabelList dataKey="onTime" content={NaLabel} />
            </Bar>
            <Bar dataKey="totalBar" name="Total" fill={SERIES[1].color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
