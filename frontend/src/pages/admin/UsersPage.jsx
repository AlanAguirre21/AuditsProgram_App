import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../api/client.js';
import { usersApi } from '../../api/users.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import Table from '../../components/ui/Table.jsx';
import { qk } from '../../constants/queryKeys.js';
import { ROLES } from '../../constants/roles.js';
import UserEditModal from '../../features/users/components/UserEditModal.jsx';
import UserReassignModal from '../../features/users/components/UserReassignModal.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import es from '../../i18n/es.js';
import { formatDateTime } from '../../utils/dates.js';

export default function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [reassigning, setReassigning] = useState(null);
  const [toggling, setToggling] = useState(null);
  const filters = { q: useDebounce(q) || undefined, role: role || undefined, active: active || undefined, page, limit: 50 };
  const { data, isLoading, error } = useQuery({ queryKey: qk.users(filters), queryFn: () => usersApi.list(filters), placeholderData: keepPreviousData });

  const done = () => qc.invalidateQueries({ queryKey: ['users'] });
  const update = useMutation({ mutationFn: ({ id, body }) => usersApi.update(id, body), onSuccess: () => { done(); setEditing(null); setToggling(null); } });
  const reassign = useMutation({ mutationFn: ({ id, body }) => usersApi.reassign(id, body), onSuccess: () => { done(); qc.invalidateQueries({ queryKey: ['occurrences'] }); } });

  const columns = [
    { key: 'name', header: 'Usuario', render: (u) => (<div><p className="font-medium">{u.name}</p><p className="text-xs text-text-muted">{u.email}</p></div>) },
    { key: 'dept', header: 'Departamento', className: 'text-xs', render: (u) => (<><p>{u.department || '—'}</p><p className="text-text-muted">{u.managerId?.name ? `Jefe: ${u.managerId.name}` : ''}</p></>) },
    { key: 'roles', header: 'Roles', render: (u) => (<div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone={r === 'ADMIN' ? 'accent' : 'neutral'}>{es.roles[r]}</Badge>)}{u.isQualitySupervisor && <Badge tone="success">Supervisor</Badge>}</div>) },
    { key: 'last', header: 'Último acceso', className: 'text-xs whitespace-nowrap', render: (u) => formatDateTime(u.lastLoginAt) },
    { key: 'status', header: 'Estado', render: (u) => (u.active ? <Badge tone="success">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>) },
    {
      key: 'actions',
      header: '',
      className: 'text-right whitespace-nowrap',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => setEditing(u)}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={() => { reassign.reset(); setReassigning(u); }}>Reasignar</Button>
          <Button size="sm" variant="ghost" onClick={() => { update.reset(); setToggling(u); }}>{u.active ? 'Desactivar' : 'Activar'}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Los usuarios se registran solos con su correo corporativo y entran como Consulta. Aquí asignas roles." />
      <Card className="mb-4" bodyClassName="flex flex-wrap items-end gap-3 p-4">
        <div className="w-64"><Input type="search" aria-label="Buscar usuario" placeholder="Nombre, correo o departamento" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <div className="w-44"><Select aria-label="Rol" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} placeholder="Todos los roles" options={ROLES.map((r) => ({ value: r, label: es.roles[r] }))} /></div>
        <div className="w-36"><Select aria-label="Estado" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} placeholder="Todos" options={[{ value: 'true', label: 'Activos' }, { value: 'false', label: 'Inactivos' }]} /></div>
      </Card>
      <Card bodyClassName="p-2">
        {isLoading && <FullPageSpinner />}
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && <Table columns={columns} rows={data.items} empty={<EmptyState title="Sin usuarios" />} />}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 px-3 py-2 text-xs text-text-muted">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            Página {data.meta.page} de {data.meta.totalPages}
            <Button size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        )}
      </Card>

      {editing && <UserEditModal user={editing} onClose={() => setEditing(null)} mutation={{ ...update, mutate: (body) => update.mutate({ id: editing._id, body }) }} />}
      {reassigning && <UserReassignModal user={reassigning} onClose={() => setReassigning(null)} mutation={{ ...reassign, mutate: (body) => reassign.mutate({ id: reassigning._id, body }) }} />}
      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.active ? 'Desactivar usuario' : 'Activar usuario'}
        message={toggling?.active ? `${toggling?.name} ya no podrá iniciar sesión. Si tiene auditorías abiertas, primero debes reasignarlas.` : `${toggling?.name} podrá volver a iniciar sesión.`}
        confirmLabel={toggling?.active ? 'Desactivar' : 'Activar'}
        variant={toggling?.active ? 'danger' : 'primary'}
        loading={update.isPending}
        error={update.error && errorMessage(update.error)}
        onClose={() => setToggling(null)}
        onConfirm={() => update.mutate({ id: toggling._id, body: { active: !toggling.active } })}
      />
    </>
  );
}
