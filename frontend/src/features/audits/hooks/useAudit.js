import { useQuery } from '@tanstack/react-query';
import { auditsApi } from '../../../api/audits.api.js';
import { qk } from '../../../constants/queryKeys.js';

export const useAudit = (id) => useQuery({ queryKey: qk.audit(id), queryFn: () => auditsApi.get(id), enabled: Boolean(id) });
