import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteMetadata } from "../lib/site";
import { getSiteUrl } from "../lib/seo";
import "./globals.css";
import { YandexMetrica } from "./yandex-metrica";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: siteMetadata.title,
  description: siteMetadata.description,
  openGraph: {
    title: siteMetadata.title,
    description: siteMetadata.description,
    siteName: siteMetadata.title,
    type: "website",
    locale: "ru_RU",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body>
        <YandexMetrica />
        {children}
      </body>
    </html>
  );
}