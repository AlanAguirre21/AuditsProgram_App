import axios from 'axios';

const TOKEN_KEY = 'ap_token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1', timeout: 60_000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Called on 401 for an authenticated request (session expired or revoked). */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthRoute = error.config?.url?.startsWith('/auth/') && !error.config.url.startsWith('/auth/me');
    if (error.response?.status === 401 && !isAuthRoute && tokenStore.get()) {
      tokenStore.clear();
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Unwraps `{ data, meta }`. */
export const unwrap = (res) => res.data.data;
export const unwrapPage = (res) => ({ items: res.data.data, meta: res.data.meta });

/** Human message from an API error (spec 9.1 error format). */
export function errorMessage(error, fallback = 'Ocurrió un error. Intenta de nuevo.') {
  const apiError = error?.response?.data?.error;
  if (apiError?.details?.issues?.length) {
    return `${apiError.message}: ${apiError.details.issues.map((i) => i.message).join('; ')}`;
  }
  if (apiError?.message) return apiError.message;
  if (error?.code === 'ECONNABORTED') return 'El servidor tardó demasiado en responder.';
  if (error?.message === 'Network Error') return 'No hay conexión con el servidor.';
  return fallback;
}

export const errorCode = (error) => error?.response?.data?.error?.code;
