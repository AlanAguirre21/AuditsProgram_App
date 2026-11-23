const TONES = {
  info: 'bg-accent-soft/80 text-zf-blue border-accent/20',
  success: 'bg-green-50/90 text-green-800 border-green-200',
  warning: 'bg-orange-50/90 text-orange-800 border-orange-200',
  danger: 'bg-red-50/90 text-red-700 border-red-200',
};

export default function Alert({ tone = 'info', title, children, className = '' }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-control border px-3.5 py-2.5 text-sm ${TONES[tone]} ${className}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}
