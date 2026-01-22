import axios from 'axios';

const getApiUrl = () => {
  // Se estiver rodando no seu computador (localhost) ou no Google IDX
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com')) {
    return `http://${window.location.hostname}:3000`;
  }
  
  // Se estiver na produção (VPS), usa o "Recepcionista" (Proxy do Nginx)
  // Isso resolve o erro de "Mixed Content" e SSL
  return '/api';
};

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para ajudar no diagnóstico se houver erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Erro na chamada da API:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);