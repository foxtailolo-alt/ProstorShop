import type { ReactNode } from "react";
import Script from "next/script";
import { StoreFooter } from "../../components/layout/store-footer";
import { TelegramMiniAppBootstrap } from "./mini-app/telegram-mini-app-bootstrap";

type StoreLayoutProps = {
  children: ReactNode;
};

export default function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?62" strategy="beforeInteractive" />
      <TelegramMiniAppBootstrap />
      {children}
      <StoreFooter />
    </>
  );
}