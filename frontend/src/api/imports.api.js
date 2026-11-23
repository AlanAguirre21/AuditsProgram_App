import { api, unwrap } from './client.js';

export const importsApi = {
  preview: (file, year) => {
    const form = new FormData();
    form.append('year', String(year));
    form.append('file', file);
    return api.post('/imports/excel/preview', form).then(unwrap);
  },
  get: (id) => api.get(`/imports/${id}`).then(unwrap),
  patch: (id, body) => api.patch(`/imports/${id}`, body).then(unwrap),
  createGroups: (id) => api.post(`/imports/${id}/create-groups`).then(unwrap),
  confirm: (id) => api.post(`/imports/${id}/confirm`).then(unwrap),
  discard: (id) => api.delete(`/imports/${id}`),
  rolloverPreview: (body) => api.post('/imports/rollover/preview', body).then(unwrap),
  rolloverConfirm: (body) => api.post('/imports/rollover/confirm', body).then(unwrap),
};
