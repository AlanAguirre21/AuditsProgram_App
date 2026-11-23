import { api, unwrap } from './client.js';

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard').then(unwrap),
  compliance: (year, groupBy) => api.get('/reports/compliance', { params: { year, groupBy } }).then(unwrap),
  exportProgram: (year, format) => api.get(`/reports/export/program.${format}`, { params: { year }, responseType: 'blob' }),
};
