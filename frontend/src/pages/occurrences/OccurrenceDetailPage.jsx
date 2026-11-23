import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import { occurrencesApi } from '../../api/occurrences.api.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import CompleteOccurrenceModal from '../../features/occurrences/components/CompleteOccurrenceModal.jsx';
import EvidenceList from '../../features/occurrences/components/EvidenceList.jsx';
import HistoryTimeline from '../../features/occurrences/components/HistoryTimeline.jsx';
import NotificationHistory from '../../features/occurrences/components/NotificationHistory.jsx';
import OccurrenceActions from '../../features/occurrences/components/OccurrenceActions.jsx';
import OccurrenceSummary from '../../features/occurrences/components/OccurrenceSummary.jsx';
import ReasonModal from '../../features/occurrences/components/ReasonModal.jsx';
import ReassignModal from '../../features/occurrences/components/ReassignModal.jsx';
import RescheduleModal from '../../features/occurrences/components/RescheduleModal.jsx';
import { useOccurrence, useOccurrenceHistory, useOccurrenceMutation } from '../../features/occurrences/hooks/useOccurrence.js';
import { PATHS } from '../../routes/paths.js';
import { formatDate, toKey } from '../../utils/dates.js';

/** Same rule as the backend (BR-14 + BR-33): performedAt after the effective due date is late. */
const isLate = (occ) => toKey(occ.completion?.performedAt) > toKey(occ.evaluateAgainstOriginal ? occ.originalDueDate : occ.dueDate);

/** Target of every email link: detail, completion, evidence, reschedule, validation and history. */
export default function OccurrenceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: occ, isLoading, error } = useOccurrence(id);
  const history = useOccurrenceHistory(id);
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const opts = { onSuccess: close };

  const validate = useOccurrenceMutation(() => occurrencesApi.validate(id), opts);
  const reject = useOccurrenceMutation((c) => occurrencesApi.reject(id, c), opts);
  const approveRs = useOccurrenceMutation(() => occurrencesApi.approveReschedule(id), opts);
  const rejectRs = useOccurrenceMutation((c) => occurrencesApi.rejectReschedule(id, c), opts);
  const cancel = useOccurrenceMutation((r) => occurrencesApi.cancel(id, r), opts);
  const closeNotDone = useOccurrenceMutation((r) => occurrencesApi.closeNotDone(id, r), opts);
  const reopen = useOccurrenceMutation((r) => occurrencesApi.reopen(id, r), opts);
  const reassign = useOccurrenceMutation((b) => occurrencesApi.reassign(id, b), opts);

  if (isLoading) return <FullPageSpinner />;
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  const p = occ.permissions;
  const def = occ.definitionId;

  return (
    <>
      <PageHeader
        back={{ to: `${PATHS.program}?year=${occ.year}`, label: `Programa ${occ.year}` }}
        title={`#${def.code} · ${def.name}`}
        subtitle={`${def.standard} · ${def.requiredBy.join(', ')}`}
        actions={<OccurrenceActions permissions={p} onAction={setModal} busy={validate.isPending || approveRs.isPending} />}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card title="Detalle">
            <OccurrenceSummary occ={occ} />
          </Card>
          <Card title={`Evidencia (${occ.evidence.length})`}>
            <EvidenceList occurrenceId={id} evidence={occ.evidence} canUpload={p.canUploadEvidence} canDelete={occ.status === 'PROGRAMADA'} currentUserId={user._id} isAdmin={p.isAdmin} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Historial" className="h-fit">
            {history.isLoading ? <FullPageSpinner /> : <HistoryTimeline entries={history.data} />}
          </Card>
          {(p.isOwner || p.isAdmin) && (
            <Card title="Notificaciones de Teams" className="h-fit">
              <NotificationHistory occurrenceId={id} />
            </Card>
          )}
        </div>
      </div>

      {modal === 'complete' && <CompleteOccurrenceModal open onClose={close} occ={occ} />}
      {(modal === 'reschedule' || modal === 'rescheduleDirect') && <RescheduleModal open onClose={close} occ={occ} mode={modal === 'rescheduleDirect' ? 'direct' : 'request'} />}
      <ConfirmDialog
        open={modal === 'validate'}
        title="Validar registro"
        message={`Se marcará como «${isLate(occ) ? 'Realizada fuera de tiempo' : 'Realizada'}». ¿Confirmas que la evidencia es correcta?`}
        confirmLabel="Validar"
        variant="success"
        loading={validate.isPending}
        error={validate.error && errorMessage(validate.error)}
        onClose={close}
        onConfirm={() => validate.mutate()}
      />
      <ConfirmDialog
        open={modal === 'approveReschedule'}
        title="Aprobar reprogramación"
        message={`La nueva fecha será ${formatDate(occ.rescheduleRequest?.requestedDate)}.`}
        confirmLabel="Aprobar"
        variant="success"
        loading={approveRs.isPending}
        error={approveRs.error && errorMessage(approveRs.error)}
        onClose={close}
        onConfirm={() => approveRs.mutate()}
      />
      <ReasonModal open={modal === 'reject'} onClose={close} title="Rechazar registro" description="La auditoría regresa a PROGRAMADA y el responsable deberá corregirla." label="Comentario para el responsable" confirmLabel="Rechazar" variant="danger" mutation={reject} />
      <ReasonModal open={modal === 'rejectReschedule'} onClose={close} title="Rechazar reprogramación" label="Comentario" confirmLabel="Rechazar" variant="danger" mutation={rejectRs} />
      <ReasonModal open={modal === 'cancel'} onClose={close} title="Cancelar auditoría" description="Las auditorías canceladas se excluyen de los indicadores." confirmLabel="Cancelar auditoría" variant="danger" mutation={cancel} />
      <ReasonModal open={modal === 'closeNotDone'} onClose={close} title="Cerrar como no realizada" confirmLabel="Cerrar" variant="danger" mutation={closeNotDone} />
      <ReasonModal open={modal === 'reopen'} onClose={close} title="Reabrir auditoría" description="Regresa a PROGRAMADA." confirmLabel="Reabrir" variant="warning" mutation={reopen} />
      {modal === 'reassign' && <ReassignModal open onClose={close} currentOwnerId={occ.ownerUserId?._id} mutation={reassign} />}
    </>
  );
}
