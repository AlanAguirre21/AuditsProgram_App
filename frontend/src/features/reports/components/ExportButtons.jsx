import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import { reportsApi } from '../../../api/reports.api.js';
import Icon from '../../../components/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import { saveBlobResponse } from '../../../utils/download.js';

/** Excel (same layout as the current template) and PDF (A3 landscape) exports of the program. */
export default function ExportButtons({ year }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const download = async (format) => {
    setBusy(format);
    setError('');
    try {
      saveBlobResponse(await reportsApi.exportProgram(year, format), `Programa General de Auditorias ${year}.${format}`);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo generar el archivo'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => download('xlsx')} loading={busy === 'xlsx'} disabled={Boolean(busy)}>
        <Icon name="download" size={14} /> Excel
      </Button>
      <Button size="sm" onClick={() => download('pdf')} loading={busy === 'pdf'} disabled={Boolean(busy)}>
        <Icon name="download" size={14} /> PDF
      </Button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </div>
  );
}
