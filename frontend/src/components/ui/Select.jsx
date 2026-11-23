import { forwardRef } from 'react';

/** options: [{ value, label }] */
const Select = forwardRef(function Select({ options = [], placeholder, className = '', ...props }, ref) {
  return (
    <select
      ref={ref}
      {...props}
      className={`neu-inset w-full bg-white/60 border border-white/50 rounded-control px-3 py-1.5 text-sm text-text
        focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow disabled:opacity-60
        aria-[invalid=true]:border-danger ${className}`}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export default Select;
