import axios, { AxiosResponse, AxiosError } from 'axios';
import { getDeviceToken, getToken, logoutLocal } from '../auth/authStorage';

// Adicionamos o "export" aqui para que as outras telas possam ler esta função
export const getApiUrl = (path?: string) => {
  const base = (window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com'))
    ? `http://${window.location.hostname}:3000/api`
    : '/api';
  
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const deviceToken = getDeviceToken();
  if (deviceToken) {
    config.headers['X-Device-Token'] = deviceToken;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    console.error('Erro na chamada da API:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    if (error.response?.status === 401) {
      // Evitar redirect infinito se o erro 401 vier do proprio login (credenciais invalidas)
      if (error.config?.url?.includes('/auth/login')) {
         return Promise.reject(error);
      }
      logoutLocal();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
