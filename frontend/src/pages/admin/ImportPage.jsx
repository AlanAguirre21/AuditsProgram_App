import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import { groupsApi } from '../../api/groups.api.js';
import { importsApi } from '../../api/imports.api.js';
import { usersApi } from '../../api/users.api.js';
import FileUpload from '../../components/FileUpload.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Select from '../../components/ui/Select.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { OCCURRENCE_RELATED, qk } from '../../constants/queryKeys.js';
import ImportPreviewTable from '../../features/imports/components/ImportPreviewTable.jsx';
import IssueList from '../../features/imports/components/IssueList.jsx';
import { useImportMutation, useImportPreview } from '../../features/imports/hooks/useImport.js';
import YearSelector from '../../features/program/components/YearSelector.jsx';
import RolloverForm from '../../features/imports/components/RolloverForm.jsx';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import es from '../../i18n/es.js';
import { PATHS } from '../../routes/paths.js';
import { currentYear } from '../../utils/dates.js';

export default function ImportPage() {
  const qc = useQueryClient();
  const [params, setParams] = useQueryParams();
  const importId = params.id;
  const [year, setYear] = useState(currentYear());
  const [result, setResult] = useState(null);
  const [bulkOwner, setBulkOwner] = useState('');
  const preview = useImportPreview(importId);
  const groups = useQuery({ queryKey: qk.groups({ active: true }), queryFn: () => groupsApi.list({ active: 'true' }) });
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup() });

  const upload = useImportMutation(null, (file) => importsApi.preview(file, year), { onSuccess: (d) => setParams({ id: d.importId }) });
  const patch = useImportMutation(importId, (body) => importsApi.patch(importId, body));
  const createGroups = useImportMutation(importId, () => importsApi.createGroups(importId), { invalidateGroups: true });
  const confirm = useImportMutation(importId, () => importsApi.confirm(importId), {
    onSuccess: (r) => {
      setResult(r);
      setParams({ id: '' });
      OCCURRENCE_RELATED.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    },
  });
  const discard = useImportMutation(importId, () => importsApi.discard(importId), { onSuccess: () => setParams({ id: '' }) });

  const data = preview.data;
  const busy = patch.isPending || createGroups.isPending || confirm.isPending || discard.isPending;
  const err = upload.error || patch.error || createGroups.error || confirm.error || discard.error || preview.error;
  const missingGroups = data?.issues.filter((i) => i.code === 'GROUP_NOT_FOUND' && i.suggestion).length ?? 0;
  const missingOwners = data?.issues.filter((i) => i.code === 'OWNER_MISSING').length ?? 0;

  return (
    <>
      <PageHeader title="Importar programa desde Excel" subtitle="Carga el archivo «Programa General de Auditorías», revisa la vista previa, corrige y confirma. Abajo: cambio de año." />
      {err && <Alert tone="danger" className="mb-4">{errorMessage(err)}</Alert>}

      {result && (
        <Alert tone="success" title="Importación completada" className="mb-4">
          Se crearon {result.definitions} auditorías y {result.occurrences} fechas en el programa {result.year}.{' '}
          <Link className="font-semibold underline" to={`${PATHS.program}?year=${result.year}`}>Ver programa</Link>
        </Alert>
      )}

      {!importId && (
        <Card title="1. Archivo">
          <div className="space-y-4">
            <div>
              <label htmlFor="imp-year" className="mb-1 block text-xs font-medium text-text-muted">Año del programa</label>
              <YearSelector id="imp-year" value={year} onChange={setYear} />
            </div>
            <FileUpload multiple={false} accept=".xlsx" disabled={upload.isPending} onFiles={([f]) => upload.mutate(f)} label="Arrastra el archivo .xlsx aquí o haz clic para seleccionarlo" hint="La vista previa se conserva 24 horas." />
            {upload.isPending && <FullPageSpinner />}
          </div>
        </Card>
      )}

      {importId && preview.isLoading && <FullPageSpinner />}
      {data && (
        <div className="space-y-5">
          <Card
            title={`2. Vista previa · ${data.fileName} · programa ${data.year}`}
            actions={
              <>
                <Button onClick={() => discard.mutate()} disabled={busy}>Descartar</Button>
                <Button variant="success" onClick={() => confirm.mutate()} loading={confirm.isPending} disabled={busy || data.blockingCount > 0}>
                  Confirmar importación
                </Button>
              </>
            }
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="text-sm">
                  <strong>{data.definitions.length}</strong> auditorías · <strong>{data.occurrencesCount}</strong> fechas · {data.changeHistory?.length ?? 0} revisiones en la bitácora del archivo
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="text-xs">
                    <caption className="mb-1 text-left text-text-muted">Programadas por mes (leídas / archivo)</caption>
                    <tbody>
                      <tr>{data.monthly.map((m) => <th key={m.month} scope="col" className="px-1.5 font-medium capitalize text-text-muted">{es.months[m.month - 1]}</th>)}</tr>
                      <tr>{data.monthly.map((m) => <td key={m.month} className={`px-1.5 text-center font-semibold ${m.file != null && m.file !== m.parsed ? 'text-danger' : 'text-success'}`}>{m.parsed}/{m.file ?? '–'}</td>)}</tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <IssueList issues={data.issues} />
            </div>
          </Card>

          {(missingGroups > 0 || missingOwners > 0) && (
            <Card title="Correcciones rápidas" bodyClassName="flex flex-wrap items-end gap-4 p-5">
              {missingGroups > 0 && (
                <Button onClick={() => createGroups.mutate()} loading={createGroups.isPending} disabled={busy}>
                  Crear grupos que no existen
                </Button>
              )}
              {missingOwners > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-64">
                    <label htmlFor="bulk-owner" className="mb-1 block text-xs font-medium text-text-muted">Responsable para las {missingOwners} filas sin responsable</label>
                    <Select id="bulk-owner" value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} placeholder="Selecciona…" options={(users.data ?? []).map((u) => ({ value: u._id, label: u.name }))} />
                  </div>
                  <Button variant="primary" disabled={!bulkOwner || busy} loading={patch.isPending} onClick={() => patch.mutate({ bulk: { defaultOwnerUserId: bulkOwner } })}>Aplicar</Button>
                </div>
              )}
            </Card>
          )}

          <Card title="3. Revisión por fila" bodyClassName="p-2">
            <ImportPreviewTable
              definitions={data.definitions}
              issues={data.issues}
              groups={groups.data ?? []}
              users={users.data ?? []}
              disabled={busy}
              onUpdate={(row, p) => patch.mutate({ updates: [{ row, ...p }] })}
            />
          </Card>
        </div>
      )}

      {!importId && (
        <Card title="Cambio de año" className="mt-5">
          <p className="mb-4 text-sm text-text-muted">Copia las auditorías activas de un año al siguiente con fechas en los mismos meses. Úsalo cuando el programa del nuevo año no venga en Excel.</p>
          <RolloverForm />
        </Card>
      )}
    </>
  );
}
