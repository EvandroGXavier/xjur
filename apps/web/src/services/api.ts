import axios, { AxiosResponse, AxiosError } from 'axios';
import { getDeviceToken, getToken, logoutLocal } from '../auth/authStorage';

// Adicionamos o "export" aqui para que as outras telas possam ler esta função
export const getApiUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com')) {
    return `http://${window.location.hostname}:3000/api`;
  }
  // Em produção, usa caminho relativo (Proxy Reverso cuida do resto)
  return '/api';
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
      // Evitar redirect infinito se o erro 401 vier do prprio login (credenciais invlidas)
      if (error.config?.url?.includes('/auth/login')) {
         return Promise.reject(error);
      }
      logoutLocal();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
