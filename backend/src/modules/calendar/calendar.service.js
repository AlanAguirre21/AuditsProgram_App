import { AppError } from '../../utils/AppError.js';
import { parseDateKey, toDateKey, yearOf } from '../../utils/dates.js';
import * as changelog from '../changelog/changelog.service.js';
import { NonWorkingDay } from './calendar.model.js';

export async function list(year) {
  const filter = year ? { year } : {};
  return NonWorkingDay.find(filter).sort({ date: 1 }).lean();
}

/** Set of 'YYYY-MM-DD' keys for the given years (all years if omitted). */
export async function nonWorkingSet(years) {
  const filter = years?.length ? { year: { $in: years } } : {};
  const docs = await NonWorkingDay.find(filter, { date: 1 }).lean();
  return new Set(docs.map((d) => toDateKey(d.date)));
}

export async function create({ date, description }, user) {
  const exists = await NonWorkingDay.findOne({ date: parseDateKey(date) });
  if (exists) throw AppError.duplicate('Ese día ya está registrado como no laborable');
  const doc = await NonWorkingDay.create({ date: parseDateKey(date), description, year: yearOf(date) });
  await changelog.record({ entity: 'NonWorkingDay', entityId: doc._id, action: 'CREATE', after: { date, description }, user });
  return doc.toObject();
}

export async function remove(id, user) {
  const doc = await NonWorkingDay.findById(id);
  if (!doc) throw AppError.notFound('Día no encontrado');
  await doc.deleteOne();
  await changelog.record({
    entity: 'NonWorkingDay',
    entityId: doc._id,
    action: 'DELETE',
    before: { date: toDateKey(doc.date), description: doc.description },
    user,
  });
}
