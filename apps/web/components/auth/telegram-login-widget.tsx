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

export function TelegramLoginWidget() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const redirectTo = searchParams.get("redirect")?.startsWith("/")
    ? searchParams.get("redirect")
    : "/admin";

  useEffect(() => {
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