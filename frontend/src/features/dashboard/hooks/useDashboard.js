import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../api/reports.api.js';
import { qk } from '../../../constants/queryKeys.js';

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: reportsApi.dashboard, refetchInterval: 5 * 60_000 });
