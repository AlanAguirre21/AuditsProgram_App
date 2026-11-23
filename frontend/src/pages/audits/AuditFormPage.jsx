import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import AuditForm from '../../features/audits/components/AuditForm.jsx';
import { useAudit } from '../../features/audits/hooks/useAudit.js';
import { useSaveAudit } from '../../features/audits/hooks/useSaveAudit.js';
import { PATHS } from '../../routes/paths.js';

export default function AuditFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audit = useAudit(id);
  const save = useSaveAudit(id, { onSuccess: (saved) => navigate(PATHS.audit(saved._id ?? id), { replace: true }) });

  if (id && audit.isLoading) return <FullPageSpinner />;
  if (id && audit.error) return <Alert tone="danger">{errorMessage(audit.error)}</Alert>;

  return (
    <>
      <PageHeader
        back={id ? { to: PATHS.audit(id), label: 'Detalle' } : { to: PATHS.audits, label: 'Catálogo' }}
        title={id ? `Editar #${audit.data.code} · ${audit.data.name}` : 'Nueva auditoría'}
      />
      <AuditForm initial={id ? audit.data : null} mutation={save} onSubmit={(body) => save.mutate(body)} onCancel={() => navigate(-1)} />
    </>
  );
}
