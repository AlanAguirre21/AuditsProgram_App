import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { calendarApi } from '../../api/calendar.api.js';
import { errorMessage } from '../../api/client.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import Table from '../../components/ui/Table.jsx';
import { qk } from '../../constants/queryKeys.js';
import YearSelector from '../../features/program/components/YearSelector.jsx';
import { currentYear, formatDate } from '../../utils/dates.js';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export default function CalendarPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(currentYear());
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: qk.calendar(year), queryFn: () => calendarApi.list(year) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['calendar'] });
  const create = useMutation({ mutationFn: calendarApi.create, onSuccess: () => { setDate(''); setDescription(''); refresh(); } });
  const remove = useMutation({ mutationFn: calendarApi.remove, onSuccess: refresh });

  const columns = [
    { key: 'date', header: 'Fecha', render: (d) => <span className="whitespace-nowrap">{formatDate(d.date)}</span> },
    { key: 'day', header: 'Día', className: 'capitalize text-text-muted', render: (d) => WEEKDAYS[new Date(d.date).getUTCDay()] },
    { key: 'description', header: 'Descripción' },
    { key: 'a', header: '', className: 'text-right', render: (d) => <Button size="sm" variant="ghost" onClick={() => remove.mutate(d._id)} disabled={remove.isPending}>Eliminar</Button> },
  ];

  return (
    <>
      <PageHeader title="Días no laborables" subtitle="Afectan la fecha límite por defecto (último día hábil del mes) y, en la fase 2, el envío de recordatorios." />
      <Card className="mb-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ date, description: description.trim() });
          }}
        >
          <Field label="Fecha" required>{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Descripción" required className="min-w-64 flex-1">{(p) => <Input {...p} placeholder="Día festivo, paro de planta…" value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <Button type="submit" variant="primary" loading={create.isPending} disabled={!date || description.trim().length < 2}>Agregar</Button>
        </form>
        {(create.error || remove.error) && <Alert tone="danger" className="mt-3">{errorMessage(create.error || remove.error)}</Alert>}
      </Card>
      <Card title="Calendario" actions={<YearSelector value={year} onChange={setYear} />} bodyClassName="p-2">
        {isLoading && <FullPageSpinner />}
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && <Table columns={columns} rows={data} empty={<EmptyState title={`Sin días no laborables en ${year}`} />} />}
      </Card>
    </>
  );
}
