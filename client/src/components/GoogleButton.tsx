import { useEffect, useRef, useState } from 'react';
import { currentLang } from '../i18n/lang';

type GsiId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GsiId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise: Promise<void> | null = null;

/** Google'дун кирүү скриптин бир гана жолу жүктөйбүз */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gsiPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gsiPromise = null;
      reject(new Error('gsi'));
    };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/** «Google менен кирүү» баскычы (Google Identity Services). onCredential — Google берген ID-токен. */
export function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGsi()
      .then(() => {
        if (!alive || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), ux_mode: 'popup' });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: Math.min(320, ref.current.clientWidth || 320),
          locale: currentLang === 'ru' ? 'ru' : 'ky',
        });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [clientId]);

  if (failed) return null;
  return <div ref={ref} className="flex min-h-[44px] w-full justify-center" />;
}
