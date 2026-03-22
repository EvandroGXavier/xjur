import { useEffect, useRef, useState } from 'react';
import { fetchProtectedMediaBlob } from '../services/protectedMedia';

const cache = new Map<string, string>();

export function useProtectedMediaUrl(mediaUrl?: string | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setObjectUrl(null);
      return;
    }

    const normalized = mediaUrl.trim();
    if (!normalized) {
      setObjectUrl(null);
      return;
    }

    const cached = cache.get(normalized);
    if (cached) {
      setObjectUrl(cached);
      return;
    }

    let canceled = false;
    fetchProtectedMediaBlob(normalized)
      .then((blob) => {
        if (canceled) return;
        const url = URL.createObjectURL(blob);
        cache.set(normalized, url);
        lastUrlRef.current = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (canceled) return;
        setObjectUrl(null);
      });

    return () => {
      canceled = true;
      // Cache is kept to avoid refetching; URLs are revoked on page reload.
    };
  }, [mediaUrl]);

  return objectUrl;
}

