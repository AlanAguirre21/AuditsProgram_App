import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import { evidenceApi } from '../../../api/evidence.api.js';
import FileUpload from '../../../components/FileUpload.jsx';
import Icon from '../../../components/Icon.jsx';
import Alert from '../../../components/ui/Alert.jsx';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';
import { formatDateTime } from '../../../utils/dates.js';
import { saveBlobResponse } from '../../../utils/download.js';
import { formatBytes } from '../../../utils/formatters.js';
import { useOccurrenceMutation } from '../hooks/useOccurrence.js';

export const EVIDENCE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,.msg';
const MAX_MB = 20;

export default function EvidenceList({ occurrenceId, evidence, canUpload, canDelete, currentUserId, isAdmin }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const upload = useOccurrenceMutation((files) => evidenceApi.upload(occurrenceId, files, (e) => setProgress(Math.round((e.loaded / (e.total || 1)) * 100))), {
    onSettled: () => setProgress(null),
  });
  const remove = useOccurrenceMutation((id) => evidenceApi.remove(id), { onSuccess: () => setToDelete(null) });

  const onFiles = (files) => {
    setError('');
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return setError(`"${tooBig.name}" excede ${MAX_MB} MB`);
    upload.mutate(files, { onError: (err) => setError(errorMessage(err)) });
  };

  const download = async (ev) => {
    try {
      saveBlobResponse(await evidenceApi.download(ev._id), ev.originalName);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {evidence.length === 0 && <p className="text-sm text-text-muted">Aún no hay archivos de evidencia.</p>}
      <ul className="divide-y divide-slate-100">
        {evidence.map((ev) => (
          <li key={ev._id} className="flex items-center gap-3 py-2">
            <Icon name="file" className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => download(ev)} className="block max-w-full truncate text-left text-sm font-medium text-text hover:text-accent hover:underline">
                {ev.originalName}
              </button>
              <p className="text-xs text-text-muted">
                {formatBytes(ev.size)} · {ev.uploadedBy?.name} · {formatDateTime(ev.createdAt)}
              </p>
            </div>
            <button type="button" onClick={() => download(ev)} className="rounded-lg p-1.5 text-text-muted hover:bg-white hover:text-accent" aria-label={`Descargar ${ev.originalName}`}>
              <Icon name="download" size={16} />
            </button>
            {canDelete && (isAdmin || String(ev.uploadedBy?._id) === String(currentUserId)) && (
              <button type="button" onClick={() => setToDelete(ev)} className="rounded-lg p-1.5 text-text-muted hover:bg-white hover:text-danger" aria-label={`Eliminar ${ev.originalName}`}>
                <Icon name="trash" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canUpload && (
        <div>
          <FileUpload onFiles={onFiles} accept={EVIDENCE_ACCEPT} disabled={upload.isPending} hint={`PDF, imágenes, Excel, Word u Outlook (.msg). Máx. ${MAX_MB} MB por archivo, 10 por envío.`} />
          {upload.isPending && (
            <p className="mt-2 flex items-center gap-2 text-xs text-text-muted">
              <Spinner size={14} /> Subiendo… {progress != null ? `${progress}%` : ''}
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar evidencia"
        message={`¿Eliminar "${toDelete?.originalName}"? El archivo se conserva en el historial.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={remove.isPending}
        error={remove.error && errorMessage(remove.error)}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete._id)}
      />
    </div>
  );
}
