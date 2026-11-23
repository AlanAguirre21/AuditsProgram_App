import { Input } from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import { CATEGORIES } from '../../../constants/statuses.js';
import es from '../../../i18n/es.js';
import YearSelector from '../../program/components/YearSelector.jsx';

export default function AuditFilters({ values, onChange, years, customers, groups }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="af-year" className="mb-1 block text-xs font-medium text-text-muted">Año</label>
        <YearSelector id="af-year" value={values.year} years={years} onChange={(y) => onChange({ year: y, requiredBy: '' })} />
      </div>
      <div className="w-60">
        <label htmlFor="af-q" className="mb-1 block text-xs font-medium text-text-muted">Buscar</label>
        <Input id="af-q" type="search" placeholder="Nombre, norma o cliente" value={values.q || ''} onChange={(e) => onChange({ q: e.target.value })} />
      </div>
      <div className="w-48">
        <label htmlFor="af-cat" className="mb-1 block text-xs font-medium text-text-muted">Tipo</label>
        <Select id="af-cat" value={values.category || ''} onChange={(e) => onChange({ category: e.target.value })} placeholder={es.common.all} options={CATEGORIES.map((c) => ({ value: c, label: es.categoriesShort[c] }))} />
      </div>
      <div className="w-44">
        <label htmlFor="af-cust" className="mb-1 block text-xs font-medium text-text-muted">Cliente</label>
        <Select id="af-cust" value={values.requiredBy || ''} onChange={(e) => onChange({ requiredBy: e.target.value })} placeholder={es.common.all} options={(customers ?? []).map((c) => ({ value: c, label: c }))} />
      </div>
      <div className="w-56">
        <label htmlFor="af-group" className="mb-1 block text-xs font-medium text-text-muted">Grupo</label>
        <Select id="af-group" value={values.ownerGroupId || ''} onChange={(e) => onChange({ ownerGroupId: e.target.value })} placeholder={es.common.all} options={(groups ?? []).map((g) => ({ value: g._id, label: g.name }))} />
      </div>
    </div>
  );
}
