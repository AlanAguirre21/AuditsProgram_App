import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auditsApi } from '../../../api/audits.api.js';
import { OCCURRENCE_RELATED } from '../../../constants/queryKeys.js';

const invalidateAll = (qc) => Promise.all(OCCURRENCE_RELATED.map((queryKey) => qc.invalidateQueries({ queryKey })));

/** Create (no id) or update (with id) an audit definition. */
export function useSaveAudit(id, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => (id ? auditsApi.update(id, body) : auditsApi.create(body)),
    ...options,
    onSuccess: async (...args) => {
      await invalidateAll(qc);
      options.onSuccess?.(...args);
    },
  });
}

export function useAuditAction(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (...args) => {
      await invalidateAll(qc);
      options.onSuccess?.(...args);
    },
  });
}
