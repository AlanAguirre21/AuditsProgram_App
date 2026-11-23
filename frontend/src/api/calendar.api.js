import { api, unwrap } from './client.js';

export const calendarApi = {
  list: (year) => api.get('/calendar', { params: { year } }).then(unwrap),
  create: (body) => api.post('/calendar', body).then(unwrap),
  remove: (id) => api.delete(`/calendar/${id}`),
};
