import { api, unwrap, unwrapPage } from './client.js';

export const usersApi = {
  list: (params) => api.get('/users', { params }).then(unwrapPage),
  lookup: (q) => api.get('/users/lookup', { params: { q } }).then(unwrap),
  get: (id) => api.get(`/users/${id}`).then(unwrap),
  create: (body) => api.post('/users', body).then(unwrap),
  update: (id, body) => api.patch(`/users/${id}`, body).then(unwrap),
  reassign: (id, body) => api.post(`/users/${id}/reassign`, body).then(unwrap),
  updateMe: (body) => api.patch('/users/me', body).then(unwrap),
};
