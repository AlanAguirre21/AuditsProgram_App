import { api, unwrap } from './client.js';

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard').then(unwrap),
};
