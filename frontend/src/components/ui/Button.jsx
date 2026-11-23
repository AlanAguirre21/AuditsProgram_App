import Spinner from './Spinner.jsx';

const VARIANTS = {
  default: 'neu-raised bg-white/60 text-text border border-white/50 hover:bg-white/80',
  primary: 'bg-accent text-white border-transparent hover:brightness-110 shadow-md shadow-accent/25',
  success: 'bg-success text-white border-transparent hover:bg-success-hover shadow-md shadow-success/25',
  danger: 'bg-danger text-white border-transparent hover:bg-danger-hover shadow-md shadow-danger/25',
  warning: 'bg-warning text-white border-transparent hover:bg-warning-hover shadow-md shadow-warning/25',
  ghost: 'bg-transparent text-accent border-transparent hover:bg-accent/10',
};

const SIZES = { sm: 'px-3 py-1 text-xs', md: 'px-4 py-1.5 text-sm', lg: 'px-5 py-2.5 text-sm' };

/** `loading` disables the button while its request is in flight (NFR-09). */
export default function Button({ variant = 'default', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium border transition-all active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner size={14} className="text-current" />}
      {children}
    </button>
  );
}
