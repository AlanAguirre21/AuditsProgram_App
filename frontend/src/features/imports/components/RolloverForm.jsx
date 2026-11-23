import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorCode, errorMessage } from '../../../api/client.js';
import { importsApi } from '../../../api/imports.api.js';
import Alert from '../../../components/ui/Alert.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import { OCCURRENCE_RELATED } from '../../../constants/queryKeys.js';
import { PATHS } from '../../../routes/paths.js';
import { currentYear, formatDate } from '../../../utils/dates.js';
import YearSelector from '../../program/components/YearSelector.jsx';

/** BR-60/61: preview the clone of a year's program into the next, then confirm. */
export default function RolloverForm() {
  const qc = useQueryClient();
  const [fromYear, setFrom] = useState(currentYear());
  const [toYear, setTo] = useState(currentYear() + 1);
  const preview = useMutation({ mutationFn: importsApi.rolloverPreview });
  const confirm = useMutation({
    mutationFn: importsApi.rolloverConfirm,
    onSuccess: () => {
      preview.reset();
      OCCURRENCE_RELATED.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    },
  });
  const needsForce = errorCode(confirm.error) === 'CONFLICT';
  const p = preview.data;
  const reset = () => {
    preview.reset();
    confirm.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ro-from" className="mb-1 block text-xs font-medium text-text-muted">Copiar el programa</label>
          <YearSelector id="ro-from" value={fromYear} onChange={(y) => { setFrom(y); setTo(y + 1); reset(); }} />
        </div>
        <span className="pb-2 text-text-muted">→</span>
        <div>
          <label htmlFor="ro-to" className="mb-1 block text-xs font-medium text-text-muted">al año</label>
          <YearSelector id="ro-to" value={toYear} onChange={(y) => { setTo(y); reset(); }} />
        </div>
        <Button onClick={() => preview.mutate({ fromYear, toYear })} loading={preview.isPending}>Vista previa</Button>
      </div>
      {preview.error && <Alert tone="danger">{errorMessage(preview.error)}</Alert>}
      {confirm.data && (
        <Alert tone="success" title="Cambio de año completado">
          Se crearon {confirm.data.definitions} auditorías y {confirm.data.occurrences} fechas en {confirm.data.toYear}
          {confirm.data.skipped.length > 0 && ` (se omitieron las que ya existían: ${confirm.data.skipped.map((c) => `#${c}`).join(', ')})`}.{' '}
          <Link className="font-semibold underline" to={`${PATHS.program}?year=${confirm.data.toYear}`}>Ver programa</Link>
        </Alert>
      )}
      {p && (
        <>
          <p className="text-sm">
            <strong>{p.definitions.filter((d) => !d.exists).length}</strong> auditorías y <strong>{p.occurrences}</strong> fechas pasarán de {p.fromYear} a {p.toYear}, todas como Programadas.
            {p.existingInTarget > 0 && <span className="text-warning"> El programa {p.toYear} ya tiene {p.existingInTarget} auditoría(s); esas se omitirán.</span>}
          </p>
          <div className="max-h-80 overflow-y-auto rounded-control border border-white/60 bg-white/50">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/95 text-left text-xs uppercase text-text-muted">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Auditoría</th><th className="px-3 py-2">Nuevas fechas</th></tr>
              </thead>
              <tbody>
                {p.definitions.map((d) => (
                  <tr key={d.code} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-1.5 font-semibold text-text-muted">{d.code}</td>
                    <td className="px-3 py-1.5">
                      {d.name} {d.exists && <Badge tone="warning">Ya existe</Badge>}
                      {d.warnings.map((w) => <p key={w} className="text-xs text-warning">{w}</p>)}
                    </td>
                    <td className="px-3 py-1.5 text-xs">{d.dueDates.map(formatDate).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {confirm.error && <Alert tone={needsForce ? 'warning' : 'danger'}>{errorMessage(confirm.error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button onClick={reset} disabled={confirm.isPending}>Cancelar</Button>
            <Button variant={needsForce ? 'warning' : 'success'} loading={confirm.isPending} onClick={() => confirm.mutate({ fromYear: p.fromYear, toYear: p.toYear, force: needsForce })}>
              {needsForce ? 'Crear solo las que faltan' : `Crear programa ${p.toYear}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
