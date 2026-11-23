import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditsApi } from '../../../api/audits.api.js';
import { programApi } from '../../../api/program.api.js';
import { qk } from '../../../constants/queryKeys.js';

export function useProgram(year, filters) {
  return useQuery({
    queryKey: qk.program(year, filters),
    queryFn: () => programApi.get(year, filters),
    placeholderData: keepPreviousData,
  });
}

/** Years with a program + customers of the selected year (for filters). */
export function useAuditsMeta(year) {
  return useQuery({ queryKey: qk.auditsMeta(year), queryFn: () => auditsApi.meta(year), staleTime: 5 * 60_000 });
}
