import { ROLE } from '../../constants/roles.js';
import { DONE_STATUSES, RESCHEDULE_STATUS, STATUS } from '../../constants/statuses.js';
import { hasRole } from '../../middleware/authorize.js';
import { addDays, monthOf, parseDateKey, toDateKey, todayKey, yearOf } from '../../utils/dates.js';
import { decorate } from '../occurrences/occurrence.logic.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { userGroupIds } from '../occurrences/occurrences.service.js';
import { getSettings } from '../settings/settings.service.js';
import { User } from '../users/user.model.js';
import { computeKpis } from './kpi.js';

const DEF_FIELDS = 'code name standard category requiredBy';
const UPCOMING_DAYS = 30;

const populate = (q) => q.populate('definitionId', DEF_FIELDS).populate('ownerUserId', 'name email').populate('ownerGroupId', 'name');

async function ownerSection(user, today) {
  const groupIds = await userGroupIds(user._id);
  const mineFilter = { $or: [{ ownerUserId: user._id }, { ownerGroupId: { $in: groupIds } }] };
  const todayDate = parseDateKey(today);

  const [upcoming, overdue, inValidation, recentDone] = await Promise.all([
    populate(Occurrence.find({ ...mineFilter, status: STATUS.PROGRAMADA, dueDate: { $gte: todayDate, $lte: parseDateKey(addDays(today, UPCOMING_DAYS)) } }).sort({ dueDate: 1 })).lean(),
    populate(Occurrence.find({ ...mineFilter, status: STATUS.PROGRAMADA, dueDate: { $lt: todayDate } }).sort({ dueDate: 1 })).lean(),
    populate(Occurrence.find({ ...mineFilter, status: STATUS.EN_VALIDACION }).sort({ dueDate: 1 })).lean(),
    populate(Occurrence.find({ ...mineFilter, status: { $in: DONE_STATUSES } }).sort({ 'completion.performedAt': -1 }).limit(5)).lean(),
  ]);
  const d = (list) => list.map((o) => decorate(o, today));
  return { upcoming: d(upcoming), overdue: d(overdue), inValidation: d(inValidation), recentDone: d(recentDone) };
}

async function managerSection(user, today) {
  const team = await User.find({ managerId: user._id, active: true }, { name: 1, email: 1 }).lean();
  if (!team.length) return { team: [], open: [] };
  const open = await populate(
    Occurrence.find({ ownerUserId: { $in: team.map((t) => t._id) }, status: { $in: [STATUS.PROGRAMADA, STATUS.EN_VALIDACION] } }).sort({ dueDate: 1 }),
  ).lean();
  return { team, open: open.map((o) => decorate(o, today)) };
}

async function adminSection(today) {
  const year = yearOf(today);
  const month = monthOf(today);
  const [yearOccs, settings, pendingReschedules] = await Promise.all([
    Occurrence.find({ year }, { status: 1, dueDate: 1, originalDueDate: 1, evaluateAgainstOriginal: 1 }).lean(),
    getSettings(),
    Occurrence.countDocuments({ 'rescheduleRequest.status': RESCHEDULE_STATUS.PENDING }),
  ]);
  const monthOccs = yearOccs.filter((o) => monthOf(toDateKey(o.dueDate)) === month);

  const overdue = await populate(
    Occurrence.find({ status: STATUS.PROGRAMADA, dueDate: { $lt: parseDateKey(today) } }).sort({ dueDate: 1 }).limit(100),
  ).lean();

  const ytd = computeKpis(yearOccs, today);
  const byLevel = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const o of overdue) byLevel[o.lastEscalationLevel ?? 0] += 1;

  return {
    year,
    month,
    headline: settings.lateCompletionCountsAsCompliant ? 'total' : 'onTime',
    ytd,
    currentMonth: computeKpis(monthOccs, today),
    pendingValidations: await Occurrence.countDocuments({ status: STATUS.EN_VALIDACION }),
    pendingReschedules,
    overdueByLevel: byLevel,
    overdue: overdue.map((o) => decorate(o, today)),
  };
}

/** Role-aware payload for HomePage. */
export async function dashboard(user) {
  const today = todayKey();
  const result = { today, mine: await ownerSection(user, today) };
  if (hasRole(user, ROLE.MANAGER)) result.manager = await managerSection(user, today);
  if (hasRole(user, ROLE.ADMIN)) result.admin = await adminSection(today);
  return result;
}
