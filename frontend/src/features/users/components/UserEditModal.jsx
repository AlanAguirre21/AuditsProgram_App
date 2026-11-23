import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import { usersApi } from '../../../api/users.api.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Field, Input } from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import { qk } from '../../../constants/queryKeys.js';
import { ROLES } from '../../../constants/roles.js';
import es from '../../../i18n/es.js';

/** Roles, supervisor flag, manager and profile data of one user (ADMIN). */
export default function UserEditModal({ user, onClose, mutation }) {
  const [form, setForm] = useState({
    name: user.name,
    department: user.department ?? '',
    jobTitle: user.jobTitle ?? '',
    employeeNumber: user.employeeNumber ?? '',
    roles: user.roles,
    isQualitySupervisor: user.isQualitySupervisor,
    managerId: user.managerId?._id ?? user.managerId ?? '',
  });
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup() });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleRole = (r) => setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...form, managerId: form.managerId || null, roles: form.roles.length ? form.roles : ['VIEWER'] });
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={mutation.isPending}
      title={`Editar usuario · ${user.email}`}
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button type="submit" form="user-form" variant="primary" loading={mutation.isPending}>Guardar</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        {mutation.error && <Alert tone="danger">{errorMessage(mutation.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">{(p) => <Input {...p} value={form.name} onChange={set('name')} />}</Field>
          <Field label="No. de empleado">{(p) => <Input {...p} value={form.employeeNumber} onChange={set('employeeNumber')} />}</Field>
          <Field label="Departamento">{(p) => <Input {...p} value={form.department} onChange={set('department')} />}</Field>
          <Field label="Puesto">{(p) => <Input {...p} value={form.jobTitle} onChange={set('jobTitle')} />}</Field>
          <Field label="Jefe directo (escalación N1)" className="sm:col-span-2">
            {(p) => (
              <Select {...p} value={form.managerId} onChange={set('managerId')} placeholder="Sin jefe asignado" options={(users.data ?? []).filter((u) => u._id !== user._id).map((u) => ({ value: u._id, label: `${u.name} — ${u.email}` }))} />
            )}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-muted">Roles</legend>
          <div className="flex flex-wrap gap-4">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                {es.roles[r]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={form.isQualitySupervisor} onChange={(e) => setForm((f) => ({ ...f, isQualitySupervisor: e.target.checked }))} />
          Supervisor de calidad (recibe escalaciones N2, solicitudes de validación y el resumen semanal)
        </label>
      </form>
    </Modal>
  );
}
