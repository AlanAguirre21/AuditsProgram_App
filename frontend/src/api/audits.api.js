import { api, unwrap } from './client.js';

export const auditsApi = {
  list: (params) => api.get('/audits', { params }).then(unwrap),
  meta: (year) => api.get('/audits/meta', { params: { year } }).then(unwrap),
  get: (id) => api.get(`/audits/${id}`).then(unwrap),
  create: (body) => api.post('/audits', body).then(unwrap),
  update: (id, body) => api.patch(`/audits/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/audits/${id}`),
  addOccurrences: (id, body) => api.post(`/audits/${id}/occurrences`, body).then(unwrap),
};
