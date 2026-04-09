"use client";

import { useEffect } from "react";

export function TelegramMiniAppBootstrap() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (!webApp) {
      return;
    }

    webApp.ready();
    webApp.expand();
    webApp.setHeaderColor("bg_color");
    webApp.setBackgroundColor("bg_color");
    webApp.setBottomBarColor("bottom_bar_bg_color");
    document.documentElement.dataset.telegramMiniApp = "true";

    return () => {
      delete document.documentElement.dataset.telegramMiniApp;
    };
  }, []);

  return null;
}