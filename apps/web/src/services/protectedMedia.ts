import { getApiUrl } from './api';
import { getDeviceToken, getToken } from '../auth/authStorage';

export function buildStorageUrl(mediaUrl: string) {
  const apiUrl = getApiUrl();
  const base = apiUrl.endsWith('/api') ? apiUrl.slice(0, -'/api'.length) : apiUrl === '/api' ? '' : apiUrl;
  const normalized = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${base}${normalized}`;
}

export async function fetchProtectedMediaBlob(mediaUrl: string) {
  const token = getToken();
  if (!token) throw new Error('Sem token');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const deviceToken = getDeviceToken();
  if (deviceToken) headers['X-Device-Token'] = deviceToken;

  const url = buildStorageUrl(mediaUrl);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Falha ao carregar arquivo (${res.status})`);
  }
  return res.blob();
}

export async function openProtectedMedia(mediaUrl: string) {
  const win = window.open('', '_blank');
  const blob = await fetchProtectedMediaBlob(mediaUrl);
  const objectUrl = URL.createObjectURL(blob);
  if (win) {
    win.location.href = objectUrl;
  } else {
    window.open(objectUrl, '_blank');
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

