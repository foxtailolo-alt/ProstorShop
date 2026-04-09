import type { ReactNode } from "react";
import Script from "next/script";
import { TelegramMiniAppBootstrap } from "./telegram-mini-app-bootstrap";

type MiniAppLayoutProps = {
  children: ReactNode;
};

export default function MiniAppLayout({ children }: MiniAppLayoutProps) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?62" strategy="beforeInteractive" />
      <TelegramMiniAppBootstrap />
      {children}
    </>
  );
}