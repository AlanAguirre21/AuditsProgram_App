const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  accent: 'bg-accent-soft text-zf-blue ring-accent/20',
  success: 'bg-green-50 text-green-800 ring-green-200',
  warning: 'bg-orange-50 text-orange-800 ring-orange-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

export default function Badge({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone] ?? tone} ${className}`} {...props}>
      {children}
    </span>
  );
}
