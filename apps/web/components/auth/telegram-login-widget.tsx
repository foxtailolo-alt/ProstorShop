"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const TELEGRAM_LOGIN_POLL_INTERVAL_MS = 2000;

type TelegramLinkLoginState = {
  requestId: string;
  openUrl: string;
  expiresAt: string;
};

function isIpHost(hostname: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

export function TelegramLoginWidget({ redirectToDefault = "/admin" }: { redirectToDefault?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hostError, setHostError] = useState<string | null>(null);
  const [linkLogin, setLinkLogin] = useState<TelegramLinkLoginState | null>(null);
  const [linkLoginError, setLinkLoginError] = useState<string | null>(null);
  const [linkLoginStatus, setLinkLoginStatus] = useState<"idle" | "creating" | "pending" | "authenticated" | "expired">("idle");
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
  }, []);

  useEffect(() => {
    if (!linkLogin || linkLoginStatus !== "pending") {
      return;
    }

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/auth/telegram-link/${linkLogin.requestId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Не удалось проверить статус входа через Telegram.");
        }

        const payload = (await response.json()) as {
          status: "pending" | "expired" | "authenticated" | "completed";
          redirectTo?: string;
        };

        if (cancelled) {
          return;
        }

        if (payload.status === "authenticated") {
          setLinkLoginStatus("authenticated");
          router.push((payload.redirectTo ?? redirectTo) as "/admin");
          router.refresh();
          return;
        }

        if (payload.status === "expired") {
          setLinkLoginStatus("expired");
          setLinkLoginError("Время подтверждения истекло. Запустите вход ещё раз.");
        }
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setLinkLoginError(
          caughtError instanceof Error ? caughtError.message : "Ошибка входа через Telegram.",
        );
      }
    };

    void pollStatus();
    const timer = window.setInterval(() => {
      void pollStatus();
    }, TELEGRAM_LOGIN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [linkLogin, linkLoginStatus, redirectTo, router]);

  const handleTelegramAppLogin = useCallback(async () => {
    try {
      setLinkLoginError(null);
      setLinkLoginStatus("creating");

      const response = await fetch("/api/auth/telegram-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectTo }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Не удалось подготовить вход через Telegram.");
      }

      const payload = (await response.json()) as TelegramLinkLoginState;
      setLinkLogin(payload);
      setLinkLoginStatus("pending");
      window.open(payload.openUrl, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      setLinkLoginStatus("idle");
      setLinkLoginError(
        caughtError instanceof Error ? caughtError.message : "Ошибка входа через Telegram.",
      );
    }
  }, [redirectTo]);

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
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <input
          aria-hidden="true"
          tabIndex={-1}
          disabled
          className="admin-inline-input"
          style={{ visibility: "hidden" }}
        />
        <input
          aria-hidden="true"
          tabIndex={-1}
          disabled
          className="admin-inline-input"
          style={{ visibility: "hidden" }}
        />
        <button
          type="button"
          className="button button-primary"
          onClick={() => void handleTelegramAppLogin()}
          disabled={linkLoginStatus === "creating" || linkLoginStatus === "pending"}
        >
          {linkLoginStatus === "creating" ? "Готовим вход..." : linkLoginStatus === "pending" ? "Ожидаем подтверждение в Telegram" : "Войти через Telegram"}
        </button>
        {linkLogin ? (
          <div className="glass" style={{ padding: 14, display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Подтвердите вход в боте</strong>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Если Telegram не открылся автоматически, воспользуйтесь кнопкой ниже. После подтверждения вход завершится в этой вкладке.
            </p>
            <a className="button button-secondary" href={linkLogin.openUrl} target="_blank" rel="noreferrer">
              Открыть Telegram
            </a>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Запрос активен до {new Date(linkLogin.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.
            </p>
          </div>
        ) : null}
        {linkLoginError ? <p className="auth-error">{linkLoginError}</p> : null}
      </div>
    </section>
  );
}