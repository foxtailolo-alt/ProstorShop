"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import type { TelegramAuthInput } from "../../lib/auth/types";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthInput) => void;
  }
}

const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function isIpHost(hostname: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

export function TelegramLoginWidget({ redirectToDefault = "/admin" }: { redirectToDefault?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const redirectTo = searchParams.get("redirect")?.startsWith("/")
    ? searchParams.get("redirect")
    : redirectToDefault;

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const configuredUrl = publicSiteUrl ? new URL(publicSiteUrl) : null;

    if (currentUrl.protocol !== "https:" && currentUrl.hostname !== "localhost") {
      setHostError("Telegram Login работает только по HTTPS. Откройте сайт по защищённому домену.");
      return;
    }

    if (isIpHost(currentUrl.hostname)) {
      setHostError("Telegram Login не работает на IP-адресе. Нужен домен, привязанный к боту в BotFather.");
      return;
    }

    if (configuredUrl && currentUrl.host !== configuredUrl.host) {
      setHostError("Откройте авторизацию на основном домене сайта. Telegram сверяет домен страницы с доменом бота.");
      return;
    }

    setHostError(null);

    window.onTelegramAuth = async (user) => {
      try {
        setError(null);

        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...user, redirectTo }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Не удалось выполнить вход через Telegram.");
        }

        const payload = (await response.json()) as { redirectTo: string };
        router.push(payload.redirectTo as "/admin");
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Ошибка авторизации.");
      }
    };

    return () => {
      delete window.onTelegramAuth;
    };
  }, [redirectTo, router]);

  if (!botUsername) {
    return (
      <section className="card glass">
        <div className="section-label">Вход через Telegram</div>
        <p className="muted" style={{ fontSize: 13 }}>
          Укажите <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> и <code>TELEGRAM_BOT_TOKEN</code>,
          чтобы включить вход через Telegram.
        </p>
      </section>
    );
  }

  if (hostError) {
    return (
      <section className="card glass">
        <div className="section-label">Вход через Telegram</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.57 7.42c-.12.54-.43.67-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.49.24l.17-2.48 4.5-4.07c.2-.17-.04-.27-.3-.1l-5.56 3.5-2.4-.75c-.52-.16-.53-.52.11-.77l9.37-3.61c.44-.16.82.1.67.77z" fill="#2AABEE"/>
          </svg>
          <button className="button button-primary" type="button" disabled style={{ flex: 1, opacity: 0.5 }}>
            Войти через Telegram
          </button>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{hostError}</p>
        {publicSiteUrl ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Рабочий адрес: <a href={publicSiteUrl}>{publicSiteUrl}</a>
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card glass">
      <div className="section-label">Вход через Telegram</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.57 7.42c-.12.54-.43.67-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.49.24l.17-2.48 4.5-4.07c.2-.17-.04-.27-.3-.1l-5.56 3.5-2.4-.75c-.52-.16-.53-.52.11-.77l9.37-3.61c.44-.16.82.1.67.77z" fill="#2AABEE"/>
        </svg>
        <div id="telegram-login-widget" style={{ flex: 1 }} />
      </div>
      {error ? <p className="auth-error">{error}</p> : null}
      <Script id="telegram-widget-loader" strategy="afterInteractive">
        {`
          const container = document.getElementById('telegram-login-widget');
          if (container && !container.querySelector('script')) {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.setAttribute('data-telegram-login', '${botUsername}');
            script.setAttribute('data-size', 'large');
            script.setAttribute('data-radius', '20');
            script.setAttribute('data-userpic', 'false');
            script.setAttribute('data-request-access', 'write');
            script.setAttribute('data-onauth', 'onTelegramAuth(user)');
            container.appendChild(script);
          }
        `}
      </Script>
    </section>
  );
}