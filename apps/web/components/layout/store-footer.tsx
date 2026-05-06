import Link from "next/link";
import { siteConfig } from "@prostor/core";
import { getNavigation } from "../../lib/site";
import { getRuntimeFeatureFlags } from "../../lib/data/catalog";
import { businessProfile, legalDisclaimer } from "../../lib/legal";
import { BrandLogo } from "./brand-logo";

const footerInfoLinks = [
  { href: "/privacy-policy", label: "Политика конфиденциальности" },
  { href: "/personal-data-consent", label: "Согласие на обработку данных" },
] as const;

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19.7 4.3 3.8 10.4c-1.1.4-1.1 2 0 2.4l4 1.3 1.5 4.7c.3.9 1.4 1.2 2.1.5l2.3-2.3 4.5 3.3c.8.6 2 .2 2.2-.8l2.8-13.4c.2-1.2-1-2.1-2.2-1.8Zm-9.6 9.1 7.8-6.1-6.1 7.8-.2 2.7-1.5-4.4Z" />
    </svg>
  );
}

function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M3.9 7.8c.1-.5.5-.8 1-.8h2.2c.4 0 .8.3.9.7.7 2.3 1.7 4.3 3.1 5.8V7.9c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9V11c1.3-1 2.3-2.2 3-3.8.2-.4.5-.7 1-.7h2.4c.7 0 1.1.8.8 1.4-.8 1.8-1.8 3.3-3.1 4.7 1.5.9 2.8 2.2 3.8 4 .4.6-.1 1.5-.8 1.5h-2.6c-.4 0-.7-.2-.9-.5-.7-1.1-1.5-2-2.6-2.7v2.3c0 .5-.4.9-.9.9h-.9C8.9 18.1 5.2 14.2 3.9 7.8Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6.6 2.8h2.8c.5 0 .9.3 1 .8l.8 3.7c.1.4 0 .9-.3 1.2l-1.7 1.7a15.2 15.2 0 0 0 4.6 4.6l1.7-1.7c.3-.3.8-.4 1.2-.3l3.7.8c.5.1.8.5.8 1v2.8c0 .6-.4 1-1 1A17.4 17.4 0 0 1 5.6 3.8c0-.6.4-1 1-1Z" />
    </svg>
  );
}

function AvitoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="8.5" r="3.2" fill="currentColor" opacity="0.95" />
      <circle cx="15.5" cy="7.2" r="2.6" fill="currentColor" opacity="0.7" />
      <circle cx="16.5" cy="15.5" r="4" fill="currentColor" opacity="0.55" />
      <circle cx="8.2" cy="16.1" r="2.4" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

const socialLinks = [
  { href: businessProfile.telegramUrl, label: "Telegram", Icon: TelegramIcon },
  { href: businessProfile.vkUrl, label: "VK", Icon: VkIcon },
  { href: businessProfile.phoneHref, label: businessProfile.phoneDisplay, Icon: PhoneIcon },
  { href: businessProfile.avitoUrl, label: "Avito", Icon: AvitoIcon },
] as const;

export async function StoreFooter() {
  const featureFlags = await getRuntimeFeatureFlags();
  const footerNavigation = getNavigation(featureFlags).filter((item) => item.href !== "/cart");

  return (
    <footer className="store-footer">
      <div className="store-footer-shell shell">
        <div className="store-footer-grid">
          <section className="store-footer-brand">
            <Link href="/" className="store-footer-logo" aria-label={siteConfig.legalName}>
              <BrandLogo />
            </Link>
            <div className="store-footer-socials" aria-label="Социальные сети и контакты">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  className="store-footer-social"
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                  aria-label={link.label}
                >
                  <link.Icon />
                </a>
              ))}
            </div>
            <a
              className="store-footer-yandex-card"
              href={businessProfile.yandexMapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Отзывы на Яндекс Картах"
            >
              <div className="store-footer-yandex-topline">
                <span className="store-footer-yandex-pin">●</span>
                <span>Яндекс Карты</span>
              </div>
              <div className="store-footer-yandex-rating-row">
                <strong>{businessProfile.yandexRating}</strong>
                <span className="store-footer-stars" aria-hidden="true">★★★★★</span>
              </div>
              <p>
                {businessProfile.yandexRatingsCount} оценок, {businessProfile.yandexReviewsCount} отзывов
              </p>
            </a>
          </section>

          <section>
            <h2 className="store-footer-heading">Информация</h2>
            <div className="store-footer-links">
              {footerNavigation.map((item) => (
                <Link key={item.href} href={item.href as never}>
                  {item.label}
                </Link>
              ))}
              {footerInfoLinks.map((item) => (
                <Link key={item.href} href={item.href as never}>
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="store-footer-heading">Контакты и реквизиты</h2>
            <div className="store-footer-details">
              <a href={businessProfile.phoneHref} className="store-footer-phone">{businessProfile.phoneDisplay}</a>
              <p>Адрес: Ул. Максима Горького, 153</p>
              <p>{businessProfile.proprietorName}</p>
              <p>ИНН: {businessProfile.inn}</p>
              <p className="store-footer-disclaimer">{legalDisclaimer}</p>
            </div>
          </section>
        </div>

        <div className="store-footer-bottom">
          <span>© 2026 {siteConfig.legalName}</span>
          <div className="store-footer-bottom-links">
            <Link href="/privacy-policy">Политика конфиденциальности</Link>
            <Link href="/personal-data-consent">Согласие на обработку данных</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}