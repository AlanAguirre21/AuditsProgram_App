import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import { groupsApi } from '../../api/groups.api.js';
import { usersApi } from '../../api/users.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Field } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { qk } from '../../constants/queryKeys.js';
import { PATHS } from '../../routes/paths.js';

export default function GroupDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const group = useQuery({ queryKey: qk.group(id), queryFn: () => groupsApi.get(id) });
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup() });
  const [toAdd, setToAdd] = useState('');
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: qk.group(id) }), qc.invalidateQueries({ queryKey: ['groups'] })]);

  const update = useMutation({ mutationFn: (body) => groupsApi.update(id, body), onSuccess: refresh });
  const add = useMutation({ mutationFn: (userId) => groupsApi.addMembers(id, [userId]), onSuccess: () => { setToAdd(''); refresh(); } });
  const remove = useMutation({ mutationFn: (userId) => groupsApi.removeMember(id, userId), onSuccess: refresh });

  if (group.isLoading) return <FullPageSpinner />;
  if (group.error) return <Alert tone="danger">{errorMessage(group.error)}</Alert>;
  const g = group.data;
  const memberIds = new Set(g.memberIds.map((m) => m._id));
  const userOptions = (users.data ?? []).map((u) => ({ value: u._id, label: `${u.name} — ${u.email}` }));
  const mutationError = update.error || add.error || remove.error;

  return (
    <>
      <PageHeader
        back={{ to: PATHS.adminGroups, label: 'Grupos' }}
        title={g.name}
        subtitle={g.description}
        actions={
          <Button variant={g.active ? 'ghost' : 'primary'} loading={update.isPending} onClick={() => update.mutate({ active: !g.active })}>
            {g.active ? 'Desactivar grupo' : 'Reactivar grupo'}
          </Button>
        }
      />
      {mutationError && <Alert tone="danger" className="mb-4">{errorMessage(mutationError)}</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Configuración" className="h-fit">
          <div className="space-y-4">
            <Field label="Líder (responsable por defecto)" hint="Se agrega automáticamente como miembro">
              {(p) => <Select {...p} value={g.leaderId?._id ?? ''} onChange={(e) => update.mutate({ leaderId: e.target.value || null })} placeholder="Sin líder" options={userOptions} />}
            </Field>
            <Field label="Contacto de escalación N1" hint="Se usa cuando el responsable no tiene jefe directo asignado">
              {(p) => <Select {...p} value={g.escalationContactId?._id ?? ''} onChange={(e) => update.mutate({ escalationContactId: e.target.value || null })} placeholder="Ninguno" options={userOptions} />}
            </Field>
          </div>
        </Card>
        <Card title={`Miembros (${g.memberIds.length})`} className="xl:col-span-2">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="min-w-64 flex-1">
              <Select aria-label="Usuario a agregar" value={toAdd} onChange={(e) => setToAdd(e.target.value)} placeholder="Agregar miembro…" options={userOptions.filter((o) => !memberIds.has(o.value))} />
            </div>
            <Button variant="primary" disabled={!toAdd} loading={add.isPending} onClick={() => add.mutate(toAdd)}>Agregar</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {g.memberIds.map((m) => (
              <li key={m._id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">
                    {m.name} {g.leaderId?._id === m._id && <Badge tone="accent">Líder</Badge>} {!m.active && <Badge tone="danger">Inactivo</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">{m.email}</p>
                </div>
                {g.leaderId?._id !== m._id && (
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(m._id)} disabled={remove.isPending}>Quitar</Button>
                )}
              </li>
            ))}
          </ul>
          {g.memberIds.length === 0 && <p className="text-sm text-text-muted">El grupo aún no tiene miembros.</p>}
        </Card>
        <Card title={`Auditorías asignadas (${g.definitions.length})`} className="xl:col-span-3">
          <ul className="grid gap-1 sm:grid-cols-2">
            {g.definitions.map((d) => (
              <li key={d._id}>
                <Link to={PATHS.audit(d._id)} className="text-sm hover:text-accent hover:underline">
                  <span className="text-text-muted">{d.year} · #{d.code}</span> {d.name}
                </Link>
              </li>
            ))}
          </ul>
          {g.definitions.length === 0 && <p className="text-sm text-text-muted">Sin auditorías activas.</p>}
        </Card>
      </div>
    </>
  );
}
