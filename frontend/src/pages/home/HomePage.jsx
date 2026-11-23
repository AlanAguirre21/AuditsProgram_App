import { errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import KpiCards from '../../features/dashboard/components/KpiCards.jsx';
import { useDashboard } from '../../features/dashboard/hooks/useDashboard.js';
import OccurrenceTable from '../../features/occurrences/components/OccurrenceTable.jsx';
import { formatDate } from '../../utils/dates.js';

export default function HomePage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <FullPageSpinner />;
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  const { mine, admin, manager } = data;
  const hasOwn = mine.overdue.length + mine.upcoming.length + mine.inValidation.length > 0;

  return (
    <>
      <PageHeader title={`Hola, ${user.name.split(' ')[0]}`} subtitle={`Hoy es ${formatDate(data.today)}`} />
      <div className="space-y-5">
        {admin && <KpiCards admin={admin} />}

        {mine.overdue.length > 0 && (
          <Card title={`Mis auditorías vencidas (${mine.overdue.length})`} className="ring-2 ring-danger/30">
            <OccurrenceTable items={mine.overdue} showOwner={false} />
          </Card>
        )}
        {(hasOwn || !admin) && (
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Próximas (30 días)" bodyClassName="p-2">
              <OccurrenceTable items={mine.upcoming} showOwner={false} emptyTitle="Nada próximo" emptyMessage="No tienes auditorías en los próximos 30 días." />
            </Card>
            <Card title="En validación" bodyClassName="p-2">
              <OccurrenceTable items={mine.inValidation} showOwner={false} emptyTitle="Nada en validación" />
            </Card>
          </div>
        )}

        {manager && manager.team.length > 0 && (
          <Card title={`Mi equipo · auditorías abiertas (${manager.open.length})`} bodyClassName="p-2">
            <OccurrenceTable items={manager.open} emptyTitle="Tu equipo no tiene auditorías abiertas" />
          </Card>
        )}

        {admin && (
          <Card title={`Vencidas en toda la planta (${admin.overdue.length})`} bodyClassName="p-2">
            <OccurrenceTable items={admin.overdue} emptyTitle="Sin auditorías vencidas" emptyMessage="Todas las auditorías exigibles están al día." />
          </Card>
        )}

        {!admin && !hasOwn && mine.recentDone.length === 0 && (
          <Alert tone="info" title="Aún no tienes auditorías asignadas">
            Puedes consultar el programa anual. Si debes ser responsable de auditorías, pide al administrador que te asigne el rol y tu grupo.
          </Alert>
        )}
      </div>
    </>
  );
}
