export default function EmptyState({ title = 'Sin registros', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="neu-raised flex h-12 w-12 items-center justify-center rounded-full bg-white/70 text-text-faint" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {message && <p className="max-w-sm text-xs text-text-muted">{message}</p>}
      {action}
    </div>
  );
}
