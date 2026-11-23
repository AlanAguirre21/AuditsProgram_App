import Button from '../../../components/ui/Button.jsx';

/** Action buttons shown according to the permissions computed by the API. */
export default function OccurrenceActions({ permissions: p, onAction, busy }) {
  return (
    <>
      {p.canComplete && (
        <Button variant="success" onClick={() => onAction('complete')}>
          ✓ Registrar realizada
        </Button>
      )}
      {p.canValidate && (
        <>
          <Button variant="success" onClick={() => onAction('validate')} loading={busy}>
            Validar
          </Button>
          <Button variant="danger" onClick={() => onAction('reject')}>
            Rechazar
          </Button>
        </>
      )}
      {p.canResolveReschedule && (
        <>
          <Button variant="success" onClick={() => onAction('approveReschedule')}>
            Aprobar reprogramación
          </Button>
          <Button variant="danger" onClick={() => onAction('rejectReschedule')}>
            Rechazar reprogramación
          </Button>
        </>
      )}
      {p.canRequestReschedule && !p.isAdmin && <Button onClick={() => onAction('reschedule')}>Solicitar reprogramación</Button>}
      {p.isAdmin && p.canCancel && <Button onClick={() => onAction('rescheduleDirect')}>Reprogramar</Button>}
      {p.canReassign && <Button onClick={() => onAction('reassign')}>Reasignar</Button>}
      {p.canCloseNotDone && (
        <Button variant="ghost" onClick={() => onAction('closeNotDone')}>
          No realizada
        </Button>
      )}
      {p.canCancel && (
        <Button variant="ghost" onClick={() => onAction('cancel')}>
          Cancelar
        </Button>
      )}
      {p.canReopen && (
        <Button variant="warning" onClick={() => onAction('reopen')}>
          Reabrir
        </Button>
      )}
    </>
  );
}
