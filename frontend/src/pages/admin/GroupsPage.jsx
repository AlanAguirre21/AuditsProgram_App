import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import { groupsApi } from '../../api/groups.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Field, Input, Textarea } from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import Table from '../../components/ui/Table.jsx';
import { qk } from '../../constants/queryKeys.js';
import { PATHS } from '../../routes/paths.js';

export default function GroupsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const filters = showInactive ? {} : { active: 'true' };
  const { data, isLoading, error } = useQuery({ queryKey: qk.groups(filters), queryFn: () => groupsApi.list(filters) });
  const create = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      navigate(PATHS.adminGroup(g._id));
    },
  });

  const columns = [
    { key: 'name', header: 'Grupo', render: (g) => (<div><p className="font-medium">{g.name}</p>{g.description && <p className="text-xs text-text-muted">{g.description}</p>}</div>) },
    { key: 'leader', header: 'Líder', className: 'text-sm', render: (g) => g.leaderId?.name ?? <span className="text-text-faint">Sin líder</span> },
    { key: 'esc', header: 'Contacto de escalación', className: 'text-sm', render: (g) => g.escalationContactId?.name ?? '—' },
    { key: 'members', header: 'Miembros', render: (g) => g.memberCount },
    { key: 'active', header: 'Estado', render: (g) => (g.active ? <Badge tone="success">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>) },
  ];

  return (
    <>
      <PageHeader
        title="Grupos responsables"
        subtitle="Equipos internos dueños de las auditorías. Sus miembros pueden registrar las auditorías del grupo."
        actions={<Button variant="primary" onClick={() => setCreating(true)}>+ Nuevo grupo</Button>}
      />
      <label className="mb-3 flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Mostrar inactivos
      </label>
      <Card bodyClassName="p-2">
        {isLoading && <FullPageSpinner />}
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && <Table columns={columns} rows={data} onRowClick={(g) => navigate(PATHS.adminGroup(g._id))} empty={<EmptyState title="Sin grupos" message="Créalos aquí o desde la importación del Excel." />} />}
      </Card>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        closeDisabled={create.isPending}
        title="Nuevo grupo"
        size="sm"
        footer={
          <>
            <Button onClick={() => setCreating(false)} disabled={create.isPending}>Cancelar</Button>
            <Button variant="primary" loading={create.isPending} disabled={form.name.trim().length < 2} onClick={() => create.mutate({ name: form.name.trim(), description: form.description.trim() || undefined })}>
              Crear
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          <Field label="Nombre" required>{(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Descripción">{(p) => <Textarea {...p} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
        </div>
      </Modal>
    </>
  );
}
