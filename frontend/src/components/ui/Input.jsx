import { forwardRef, useId } from 'react';

const base = `neu-inset w-full bg-white/60 border border-white/50 rounded-control px-3 py-1.5
  text-sm text-text placeholder:text-text-faint
  focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow
  disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20`;

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} {...props} className={`${base} ${className}`} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} {...props} className={`${base} resize-y ${className}`} />;
});

export function Label({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-text-muted mb-1">
      {children}
      {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

/**
 * Field wrapper: label + control + error/hint. `children` is a render function receiving the id
 * so the label is always tied to its input (NFR-07).
 */
export function Field({ label, error, hint, required, className = '', children }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {typeof children === 'function' ? children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? `${id}-msg` : undefined }) : children}
      {(error || hint) && (
        <p id={`${id}-msg`} className={`mt-1 text-xs ${error ? 'text-danger' : 'text-text-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export default Input;
