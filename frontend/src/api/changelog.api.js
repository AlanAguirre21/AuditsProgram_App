import { api, unwrapPage } from './client.js';

export const changelogApi = {
  list: (params) => api.get('/changelog', { params }).then(unwrapPage),
};
