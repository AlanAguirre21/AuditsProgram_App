import { api, unwrap } from './client.js';

export const programApi = {
  get: (year, params) => api.get(`/program/${year}`, { params }).then(unwrap),
};
