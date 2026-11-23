import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditsApi } from '../../../api/audits.api.js';
import { qk } from '../../../constants/queryKeys.js';

export const useAudits = (filters) => useQuery({ queryKey: qk.audits(filters), queryFn: () => auditsApi.list(filters), placeholderData: keepPreviousData });
