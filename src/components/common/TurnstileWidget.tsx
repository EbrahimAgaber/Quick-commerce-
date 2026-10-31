import React, { useEffect, useRef, useState } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: (err: any) => void;
          'expired-callback'?: () => void;
          theme?: string;
          language?: string;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Read public site key from Vite environment
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

  useEffect(() => {
    // If no sitekey is configured (e.g. dev mode without Turnstile keys), bypass gracefully
    if (!siteKey) {
      onVerify('dev-bypass-token');
      return;
    }

    const scriptId = 'cloudflare-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            language: 'ar',
            callback: (token: string) => {
              onVerify(token);
            },
            'error-callback': (err: any) => {
              if (onError) onError(typeof err === 'string' ? err : 'Turnstile verification error');
            },
            'expired-callback': () => {
              if (onExpire) onExpire();
            },
          });
          setIsLoaded(true);
        } catch (e) {
          console.warn('Turnstile render warning:', e);
        }
      }
    };

    if (!window.turnstile) {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          renderWidget();
        };
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', renderWidget);
      }
    } else {
      renderWidget();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="my-2 flex justify-center">
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
};
