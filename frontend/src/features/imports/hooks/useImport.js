import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importsApi } from '../../../api/imports.api.js';
import { qk } from '../../../constants/queryKeys.js';

export function useImportPreview(id) {
  return useQuery({ queryKey: qk.importPreview(id), queryFn: () => importsApi.get(id), enabled: Boolean(id), retry: false });
}

/** Mutations that return a new preview payload write it straight into the cache. */
export function useImportMutation(id, fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: (data, ...rest) => {
      if (data?.importId && data.definitions) qc.setQueryData(qk.importPreview(data.importId), data);
      if (options.invalidateGroups) qc.invalidateQueries({ queryKey: ['groups'] });
      options.onSuccess?.(data, ...rest);
    },
  });
}
