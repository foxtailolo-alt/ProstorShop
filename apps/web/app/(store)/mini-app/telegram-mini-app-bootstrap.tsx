"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MINI_APP_AUTH_STORAGE_KEY = "prostor-mini-app-auth";

export function TelegramMiniAppBootstrap() {
  const router = useRouter();

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (!webApp) {
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

    if (authUser && authDate && hash) {
      const authMarker = `${authUser.id}:${authDate}`;

      if (window.sessionStorage.getItem(MINI_APP_AUTH_STORAGE_KEY) !== authMarker) {
        void fetch("/api/auth/telegram", {
          method: "POST",
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
        })
          .then((response) => {
            if (!response.ok) {
              return null;
            }

            window.sessionStorage.setItem(MINI_APP_AUTH_STORAGE_KEY, authMarker);
            router.refresh();
            return null;
          })
          .catch(() => null);
      }
    }

    return () => {
      delete document.documentElement.dataset.telegramMiniApp;
    };
  }, [router]);

  return null;
}