"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MINI_APP_AUTH_STORAGE_KEY = "prostor-mini-app-auth";
const MINI_APP_AUTH_RETRY_DELAY_MS = 350;
const MINI_APP_AUTH_MAX_ATTEMPTS = 8;

export function TelegramMiniAppBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;

    async function bootstrapAuth(attempt = 0) {
      const webApp = window.Telegram?.WebApp;

      if (!webApp) {
        if (attempt < MINI_APP_AUTH_MAX_ATTEMPTS) {
          retryTimer = window.setTimeout(() => {
            void bootstrapAuth(attempt + 1);
          }, MINI_APP_AUTH_RETRY_DELAY_MS);
        }
        return;
      }

      webApp.ready();
      webApp.expand();
      try {
        webApp.requestFullscreen?.();
      } catch {
        // Telegram client support varies between versions.
      }
      webApp.setHeaderColor("bg_color");
      webApp.setBackgroundColor("bg_color");
      webApp.setBottomBarColor("bottom_bar_bg_color");
      document.documentElement.dataset.telegramMiniApp = "true";

      const authUser = webApp.initDataUnsafe?.user;
      const authDate = webApp.initDataUnsafe?.auth_date;
      const hash = webApp.initDataUnsafe?.hash;

      if (!authUser || !authDate || !hash) {
        if (attempt < MINI_APP_AUTH_MAX_ATTEMPTS) {
          retryTimer = window.setTimeout(() => {
            void bootstrapAuth(attempt + 1);
          }, MINI_APP_AUTH_RETRY_DELAY_MS);
        }
        return;
      }

      const authMarker = `${authUser.id}:${authDate}`;

      if (window.sessionStorage.getItem(MINI_APP_AUTH_STORAGE_KEY) === authMarker) {
        return;
      }

      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: authUser.id,
            first_name: authUser.first_name,
            last_name: authUser.last_name,
            username: authUser.username,
            photo_url: authUser.photo_url,
            auth_date: authDate,
            hash,
            redirectTo: `${window.location.pathname}${window.location.search}`,
          }),
        });

        if (!response.ok) {
          throw new Error(`Mini App auth failed with status ${response.status}`);
        }

        if (cancelled) {
          return;
        }

        window.sessionStorage.setItem(MINI_APP_AUTH_STORAGE_KEY, authMarker);
        router.refresh();
      } catch {
        if (attempt < MINI_APP_AUTH_MAX_ATTEMPTS) {
          retryTimer = window.setTimeout(() => {
            void bootstrapAuth(attempt + 1);
          }, MINI_APP_AUTH_RETRY_DELAY_MS);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      delete document.documentElement.dataset.telegramMiniApp;
    };
  }, [router]);

  return null;
}