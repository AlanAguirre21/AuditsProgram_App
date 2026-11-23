/** Glass panel used for every content block. */
export default function Card({ title, actions, className = '', bodyClassName = 'p-5', children }) {
  return (
    <section className={`glass neu-raised rounded-panel border border-white/50 bg-white/55 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/60 px-5 py-3">
          {title && <h2 className="text-sm font-semibold text-zf-blue">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
