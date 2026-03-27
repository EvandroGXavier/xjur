import { getApiUrl } from './api';
import { getDeviceToken, getToken } from '../auth/authStorage';

/**
 * Constrói a URL completa para recursos da API de forma segura.
 */
export function buildStorageUrl(mediaUrl: string) {
  if (mediaUrl.startsWith('http')) return mediaUrl;
  return getApiUrl(mediaUrl);
}

/**
 * Busca um arquivo de forma autenticada e retorna um BLOB.
 * Essencial para arquivos em rotas protegidas (por exemplo, anexos de contatos).
 */
export async function fetchProtectedMediaBlob(mediaUrl: string) {
  const token = getToken();
  if (!token) throw new Error('Falha na autenticação: Usuário não logado.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const deviceToken = getDeviceToken();
  if (deviceToken) headers['X-Device-Token'] = deviceToken;

  const url = buildStorageUrl(mediaUrl);
  
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 401) throw new Error('Sessão expirada ou não autorizada.');
      if (res.status === 404) throw new Error('Arquivo não encontrado no servidor.');
      throw new Error(`Erro do servidor (${res.status})`);
    }
    return await res.blob();
  } catch (error: any) {
    console.error(`[fetchProtectedMediaBlob] Erro ao carregar ${url}:`, error);
    throw error;
  }
}

/**
 * Abre um arquivo protegido em uma nova aba usando Blob URL.
 */
export async function openProtectedMedia(mediaUrl: string) {
  try {
    const blob = await fetchProtectedMediaBlob(mediaUrl);
    const objectUrl = URL.createObjectURL(blob);
    
    // Abre a nova janela apenas após ter o blob (opcionalmente pode abrir antes um blank e depois redirecionar)
    const win = window.open(objectUrl, '_blank');
    
    // Agenda a revogação do recurso para não vazar memória, mas dá tempo do browser ler
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return win;
  } catch (err) {
    console.error("Erro ao abrir mídia protegida:", err);
    throw err;
  }
}
