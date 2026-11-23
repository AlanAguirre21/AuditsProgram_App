import { api, unwrap } from './client.js';

export const evidenceApi = {
  upload: (occurrenceId, files, onUploadProgress) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    return api.post(`/occurrences/${occurrenceId}/evidence`, form, { onUploadProgress }).then(unwrap);
  },
  download: (id) => api.get(`/evidence/${id}/download`, { responseType: 'blob' }),
  remove: (id) => api.delete(`/evidence/${id}`),
};
