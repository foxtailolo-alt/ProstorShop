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
      <div className="card glass">
        <div className="section-label">Telegram auth</div>
        <p>
          Укажите `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` и `TELEGRAM_BOT_TOKEN`, чтобы включить вход
          через Telegram widget.
        </p>
      </div>
    );
  }

  if (hostError) {
    return (
      <div className="card glass auth-card">
        <div className="section-label">Вход через Telegram</div>
        <p>{hostError}</p>
        {publicSiteUrl ? (
          <p>
            Рабочий адрес для входа: <a href={publicSiteUrl}>{publicSiteUrl}</a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card glass auth-card">
      <div className="section-label">Вход через Telegram</div>
      <p>
        Используйте тот же Telegram, который будет у вас в Mini App и админке. Это снижает трение
        и упрощает управление доступами.
      </p>
      <div id="telegram-login-widget" />
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
    </div>
  );
}