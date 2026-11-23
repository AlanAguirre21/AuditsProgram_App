import { api, unwrap } from './client.js';

export const settingsApi = {
  get: () => api.get('/settings').then(unwrap),
  update: (body) => api.patch('/settings', body).then(unwrap),
};
