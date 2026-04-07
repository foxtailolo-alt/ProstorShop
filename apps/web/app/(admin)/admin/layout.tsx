import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession, isAdminSession } from "../../../lib/auth/session";

const adminNavigation = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/activity", label: "Журнал" },
  { href: "/admin/categories", label: "Категории и фильтры" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/trade-in", label: "Trade-in" },
  { href: "/admin/service-pricing", label: "Прайс сервиса" },
  { href: "/admin/telegram-posts", label: "Telegram посты" },
  { href: "/admin/settings", label: "Настройки" },
] as const;

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getSession();

  if (!isAdminSession(session)) {
    redirect("/login?redirect=/admin");
  }

  return (
    <div className="page shell admin-shell">
      <aside className="card glass admin-sidebar">
        <div className="section-label">Backoffice</div>
        <div className="grid">
          {adminNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="button button-secondary admin-nav-link">
              {item.label}
            </Link>
          ))}
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}