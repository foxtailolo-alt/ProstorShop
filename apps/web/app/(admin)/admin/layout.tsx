import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession, isAdminSession } from "../../../lib/auth/session";
import { MarketingToggle } from "../../../components/admin/marketing-toggle";

const adminNavigation = [
  { href: "/admin", label: "Обзор", marketing: false },
  { href: "/admin/clients", label: "Клиенты", marketing: false },
  { href: "/admin/orders", label: "Заказы", marketing: false },
  { href: "/admin/activity", label: "Журнал", marketing: false },
  { href: "/admin/categories", label: "Категории", marketing: false },
  { href: "/admin/products", label: "Товары", marketing: false },
  { href: "/admin/competitor-pricing", label: "Цены конкурентов", marketing: false },
  { href: "/admin/banners", label: "Баннеры", marketing: false },
  { href: "/admin/trade-in", label: "Trade-in", marketing: false },
  { href: "/admin/waitlist", label: "Waitlist", marketing: false },
  { href: "/admin/promo-codes", label: "Промокоды", marketing: false },
  { href: "/admin/service-pricing", label: "Прайс сервиса", marketing: false },
  { href: "/admin/telegram-posts", label: "Telegram посты", marketing: false },
  { href: "/admin/marketing", label: "📊 Маркетинг", marketing: true },
  { href: "/admin/marketing/homepage", label: "🏠 Главная страница", marketing: true },
  { href: "/admin/settings", label: "Настройки", marketing: false },
];

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getSession();

  if (!isAdminSession(session)) {
    redirect("/login?redirect=/admin");
  }

  const cookieStore = await cookies();
  const marketingEnabled = cookieStore.get("prostor_marketing")?.value === "1";

  const visibleNavigation = adminNavigation.filter(
    (item) => !item.marketing || marketingEnabled,
  );

  return (
    <div className="page shell admin-shell">
      <aside className="card glass admin-sidebar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>Backoffice</div>
          <MarketingToggle enabled={marketingEnabled} />
        </div>
        <div className="grid">
          {visibleNavigation.map((item) => (
            <Link key={item.href} href={item.href as "/"} className="button button-secondary admin-nav-link">
              {item.label}
            </Link>
          ))}
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}