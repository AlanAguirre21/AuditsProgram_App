import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auditsApi } from '../../api/audits.api.js';
import { errorCode, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import MonthPicker from '../../features/audits/components/MonthPicker.jsx';
import { useAudit } from '../../features/audits/hooks/useAudit.js';
import { useAuditAction } from '../../features/audits/hooks/useSaveAudit.js';
import OccurrenceTable from '../../features/occurrences/components/OccurrenceTable.jsx';
import es from '../../i18n/es.js';
import { PATHS } from '../../routes/paths.js';

export default function AuditDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const { data: def, isLoading, error } = useAudit(id);
  const [modal, setModal] = useState(null);
  const [months, setMonths] = useState([]);
  const add = useAuditAction((force) => auditsApi.addOccurrences(id, { months, force }), { onSuccess: () => { setModal(null); setMonths([]); } });
  const deactivate = useAuditAction(() => auditsApi.remove(id), { onSuccess: () => navigate(PATHS.audits) });

  if (isLoading) return <FullPageSpinner />;
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  const duplicate = errorCode(add.error) === 'DUPLICATE';

  return (
    <>
      <PageHeader
        back={{ to: `${PATHS.audits}?year=${def.year}`, label: 'Catálogo' }}
        title={`#${def.code} · ${def.name}`}
        subtitle={`${es.categories[def.category]} · Programa ${def.year}`}
        actions={
          isAdmin &&
          def.active && (
            <>
              <Button onClick={() => setModal('add')}>+ Agregar fechas</Button>
              <Link to={PATHS.auditEdit(id)} className="rounded-control bg-accent px-4 py-1.5 text-sm font-medium text-white shadow-md shadow-accent/25 hover:brightness-110">
                Editar
              </Link>
              <Button variant="ghost" onClick={() => setModal('deactivate')}>
                Desactivar
              </Button>
            </>
          )
        }
      />
      {!def.active && <Alert tone="warning" className="mb-4">Esta auditoría está desactivada.</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Definición" className="h-fit">
          <dl className="space-y-3 text-sm">
            {[
              ['Norma / requerimiento', def.standard],
              ['Requerido por', def.requiredBy.join(', ')],
              ['Grupo responsable', def.ownerGroupId?.name],
              ['Responsable', def.defaultOwnerUserId?.name],
              ['Ejecuta', `${def.executor?.name} (${es.executor[def.executor?.type]})`],
              ['Evidencia', def.evidenceRequired ? 'Obligatoria' : 'Opcional'],
              ['Validación', def.requiresValidation ? 'Requiere validación del supervisor' : 'Sin validación'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{k}</dt>
                <dd>{v || '—'}</dd>
              </div>
            ))}
            {def.folderPath && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Carpeta</dt>
                <dd className="break-all font-mono text-xs">{def.folderPath}</dd>
              </div>
            )}
            {def.notes && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Notas</dt>
                <dd className="whitespace-pre-line text-xs">{def.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
        <Card title={<>Fechas programadas <Badge className="ml-1">{def.occurrences.length}</Badge></>} className="xl:col-span-2" bodyClassName="p-2">
          <OccurrenceTable items={def.occurrences.map((o) => ({ ...o, definitionId: def }))} emptyTitle="Sin fechas programadas" />
        </Card>
      </div>

      <Modal
        open={modal === 'add'}
        onClose={() => setModal(null)}
        closeDisabled={add.isPending}
        title="Agregar fechas"
        size="lg"
        footer={
          <>
            <Button onClick={() => setModal(null)} disabled={add.isPending}>Cancelar</Button>
            {duplicate ? (
              <Button variant="warning" loading={add.isPending} onClick={() => add.mutate(true)}>Crear de todos modos</Button>
            ) : (
              <Button variant="primary" loading={add.isPending} disabled={!months.length} onClick={() => add.mutate(false)}>Agregar</Button>
            )}
          </>
        }
      >
        <p className="mb-3 text-sm text-text-muted">Se programará el último día hábil de cada mes seleccionado.</p>
        {add.error && <Alert tone={duplicate ? 'warning' : 'danger'} className="mb-3">{errorMessage(add.error)}</Alert>}
        <MonthPicker value={months} onChange={(m) => { setMonths(m); add.reset(); }} year={def.year} />
      </Modal>
      <ConfirmDialog
        open={modal === 'deactivate'}
        title="Desactivar auditoría"
        message="Solo se puede desactivar si todas sus fechas están cerradas o canceladas. Seguirá visible en el historial."
        confirmLabel="Desactivar"
        variant="danger"
        loading={deactivate.isPending}
        error={deactivate.error && errorMessage(deactivate.error)}
        onClose={() => setModal(null)}
        onConfirm={() => deactivate.mutate()}
      />
    </>
  );
}
