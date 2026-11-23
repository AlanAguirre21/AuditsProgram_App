import { api, unwrap, unwrapPage } from './client.js';

export const notificationsApi = {
  rules: () => api.get('/notifications/rules').then(unwrap),
  createRule: (body) => api.post('/notifications/rules', body).then(unwrap),
  updateRule: (id, body) => api.patch(`/notifications/rules/${id}`, body).then(unwrap),
  log: (params) => api.get('/notifications/log', { params }).then(unwrapPage),
  retry: (id) => api.post(`/notifications/log/${id}/retry`).then(unwrap),
  test: (body) => api.post('/notifications/test', body).then(unwrap),
  forOccurrence: (occurrenceId) => api.get(`/occurrences/${occurrenceId}/notifications`).then(unwrap),
};
