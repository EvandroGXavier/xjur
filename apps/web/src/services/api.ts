import axios, { AxiosResponse, AxiosError } from 'axios';

// Adicionamos o "export" aqui para que as outras telas possam ler esta função
export const getApiUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com')) {
    return `http://${window.location.hostname}:3000`;
  }
  return '/api';
};

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
    return Promise.reject(error);
  }
);