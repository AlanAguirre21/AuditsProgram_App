import Button from './Button.jsx';
import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', variant = 'primary', loading, onConfirm, onClose, error }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeDisabled={loading}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text">{message}</p>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
    </Modal>
  );
}
