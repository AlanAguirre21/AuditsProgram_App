import { api, unwrap, unwrapPage } from './client.js';

export const occurrencesApi = {
  list: (params) => api.get('/occurrences', { params }).then(unwrapPage),
  mine: (params) => api.get('/occurrences/mine', { params }).then(unwrap),
  get: (id) => api.get(`/occurrences/${id}`).then(unwrap),
  history: (id) => api.get(`/occurrences/${id}/history`).then(unwrap),
  reassign: (id, body) => api.patch(`/occurrences/${id}`, body).then(unwrap),
  complete: (id, body) => api.post(`/occurrences/${id}/complete`, body).then(unwrap),
  validate: (id) => api.post(`/occurrences/${id}/validate`).then(unwrap),
  reject: (id, comment) => api.post(`/occurrences/${id}/reject`, { comment }).then(unwrap),
  requestReschedule: (id, body) => api.post(`/occurrences/${id}/reschedule-request`, body).then(unwrap),
  approveReschedule: (id) => api.post(`/occurrences/${id}/reschedule-request/approve`).then(unwrap),
  rejectReschedule: (id, comment) => api.post(`/occurrences/${id}/reschedule-request/reject`, { comment }).then(unwrap),
  reschedule: (id, body) => api.post(`/occurrences/${id}/reschedule`, body).then(unwrap),
  cancel: (id, reason) => api.post(`/occurrences/${id}/cancel`, { reason }).then(unwrap),
  closeNotDone: (id, reason) => api.post(`/occurrences/${id}/close-not-done`, { reason }).then(unwrap),
  reopen: (id, reason) => api.post(`/occurrences/${id}/reopen`, { reason }).then(unwrap),
  validations: () => api.get('/validations').then(unwrap),
};
