import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { occurrencesApi } from '../../../api/occurrences.api.js';
import { OCCURRENCE_RELATED, qk } from '../../../constants/queryKeys.js';

export function useOccurrence(id) {
  return useQuery({ queryKey: qk.occurrence(id), queryFn: () => occurrencesApi.get(id), enabled: Boolean(id) });
}

export function useOccurrenceHistory(id) {
  return useQuery({ queryKey: qk.occurrenceHistory(id), queryFn: () => occurrencesApi.history(id), enabled: Boolean(id) });
}

/** Any state-changing call on an occurrence; refreshes every view that shows occurrences. */
export function useOccurrenceMutation(fn, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (...args) => {
      await Promise.all(OCCURRENCE_RELATED.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      options.onSuccess?.(...args);
    },
  });
}
