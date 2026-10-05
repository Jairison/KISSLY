import { useEffect, useState } from 'react';

import { backend } from '@/services/backend';
import { localMediaFor } from '@/services/mediaCache';

/**
 * Endereço exibível de uma foto/áudio do chat: a cópia local (se a mensagem foi
 * enviada daqui) ou um link temporário gerado pelo servidor.
 */
export function useMediaUrl(pathOrUrl: string | null) {
  const [url, setUrl] = useState<string | null>(() => (pathOrUrl ? (localMediaFor(pathOrUrl) ?? null) : null));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pathOrUrl) return;
    const local = localMediaFor(pathOrUrl);
    if (local) {
      setUrl(local);
      return;
    }
    let alive = true;
    backend
      .mediaUrl(pathOrUrl)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [pathOrUrl]);

  return { url, error };
}
