import { occurrencesApi } from '../../../api/occurrences.api.js';
import { useOccurrenceMutation } from './useOccurrence.js';

/** mode 'request' (owner asks) or 'direct' (ADMIN reschedules in one step). */
export const useReschedule = (id, mode, options) =>
  useOccurrenceMutation(
    ({ date, reason }) =>
      mode === 'direct' ? occurrencesApi.reschedule(id, { newDate: date, reason }) : occurrencesApi.requestReschedule(id, { requestedDate: date, reason }),
    options,
  );
