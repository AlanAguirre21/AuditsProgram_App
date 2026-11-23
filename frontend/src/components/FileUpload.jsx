import { useId, useRef, useState } from 'react';

/** Drag-and-drop or click file picker. Calls onFiles(File[]) with the accepted files. */
export default function FileUpload({ onFiles, accept, multiple = true, disabled, hint, label = 'Arrastra archivos aquí o haz clic para seleccionarlos' }) {
  const id = useId();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handle = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={`neu-inset rounded-control border-2 border-dashed px-4 py-5 text-center transition-colors
        ${over ? 'border-accent bg-accent-soft/60' : 'border-slate-300/70 bg-white/40'} ${disabled ? 'opacity-50' : ''}`}
    >
      <input ref={inputRef} id={id} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={disabled} onChange={(e) => handle(e.target.files)} />
      <label htmlFor={id} className={`block text-sm ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className="font-medium text-accent">{label}</span>
        {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
      </label>
    </div>
  );
}
