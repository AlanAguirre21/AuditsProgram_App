/** BR-40: on January 5, open occurrences of the previous year become NO_REALIZADA. */
import { STATUS } from '../constants/statuses.js';
import * as changelog from '../modules/changelog/changelog.service.js';
import { Occurrence } from '../modules/occurrences/occurrence.model.js';

export const YEAR_CLOSE_REASON = 'Cierre automático del programa anual (5 de enero)';

export async function runYearClose(closingYear) {
  const open = await Occurrence.find({ year: closingYear, status: STATUS.PROGRAMADA }, { _id: 1 }).lean();
  for (const { _id } of open) {
    const res = await Occurrence.updateOne(
      { _id, status: STATUS.PROGRAMADA },
      { $set: { status: STATUS.NO_REALIZADA, closure: { reason: YEAR_CLOSE_REASON, closedAt: new Date() } }, $inc: { __v: 1 } },
    );
    if (res.modifiedCount) {
      await changelog.record({
        entity: 'AuditOccurrence',
        entityId: _id,
        action: 'CLOSE_NOT_DONE',
        before: { status: STATUS.PROGRAMADA },
        after: { status: STATUS.NO_REALIZADA },
        reason: YEAR_CLOSE_REASON,
        system: true,
      });
    }
  }
  return { processed: open.length, details: { closingYear, closed: open.length } };
}
