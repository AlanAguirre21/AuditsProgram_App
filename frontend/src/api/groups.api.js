import { api, unwrap } from './client.js';

export const groupsApi = {
  list: (params) => api.get('/groups', { params }).then(unwrap),
  get: (id) => api.get(`/groups/${id}`).then(unwrap),
  create: (body) => api.post('/groups', body).then(unwrap),
  update: (id, body) => api.patch(`/groups/${id}`, body).then(unwrap),
  addMembers: (id, userIds) => api.post(`/groups/${id}/members`, { userIds }).then(unwrap),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members/${userId}`).then(unwrap),
  remove: (id) => api.delete(`/groups/${id}`),
};
