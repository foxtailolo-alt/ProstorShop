"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const redirectTo = searchParams.get("redirect")?.startsWith("/")
    ? searchParams.get("redirect")
    : redirectToDefault;

  const handleAuth = useCallback(async (user: TelegramAuthInput) => {
    try {
      setError(null);
      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  }, [redirectTo, router]);

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
  }, []);

  useEffect(() => {
    window.onTelegramAuth = handleAuth;
    return () => { delete window.onTelegramAuth; };
  }, [handleAuth]);

  useEffect(() => {
    if (hostError !== null || !botUsername || !widgetRef.current) return;
    const container = widgetRef.current;
    if (container.querySelector("iframe")) { setWidgetLoaded(true); return; }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.radius = "20";
    script.dataset.userpic = "false";
    script.dataset.requestAccess = "write";
    script.dataset.onauth = "onTelegramAuth(user)";
    script.onload = () => setWidgetLoaded(true);
    container.appendChild(script);
  }, [hostError]);

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
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: "12px auto 0" }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.57 7.42c-.12.54-.43.67-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.49.24l.17-2.48 4.5-4.07c.2-.17-.04-.27-.3-.1l-5.56 3.5-2.4-.75c-.52-.16-.53-.52.11-.77l9.37-3.61c.44-.16.82.1.67.77z" fill="#2AABEE"/>
        </svg>
        <p className="muted" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>{hostError}</p>
        {publicSiteUrl ? (
          <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>
            Рабочий адрес: <a href={publicSiteUrl}>{publicSiteUrl}</a>
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card glass">
      <div className="section-label">Вход через Telegram</div>
      {!widgetLoaded && (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: "12px auto 0", display: "block" }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.57 7.42c-.12.54-.43.67-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.49.24l.17-2.48 4.5-4.07c.2-.17-.04-.27-.3-.1l-5.56 3.5-2.4-.75c-.52-.16-.53-.52.11-.77l9.37-3.61c.44-.16.82.1.67.77z" fill="#2AABEE"/>
        </svg>
      )}
      <div ref={widgetRef} style={{ marginTop: 12, display: "flex", justifyContent: "center" }} />
      {error ? <p className="auth-error">{error}</p> : null}
    </section>
  );
}