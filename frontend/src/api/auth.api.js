import { api, unwrap } from './client.js';

export const authApi = {
  me: () => api.get('/auth/me').then(unwrap),
  register: (body) => api.post('/auth/register', body).then(unwrap),
  login: (body) => api.post('/auth/login', body).then(unwrap),
  verify: (body) => api.post('/auth/2fa/verify', body).then(unwrap),
  resend: (challengeId) => api.post('/auth/2fa/resend', { challengeId }).then(unwrap),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then(unwrap),
  resetPassword: (body) => api.post('/auth/reset-password', body).then(unwrap),
  changePassword: (body) => api.post('/auth/change-password', body).then(unwrap),
};
