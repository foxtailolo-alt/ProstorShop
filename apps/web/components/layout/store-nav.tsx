import Link from "next/link";
import type { Route } from "next";
import { siteConfig } from "@prostor/core";
import { getSession, isAdminSession } from "../../lib/auth/session";
import { getCartItems } from "../../lib/cart";
import { getRuntimeFeatureFlags } from "../../lib/data/catalog";
import { getNavigation } from "../../lib/site";
import { BrandLogo } from "./brand-logo";

export async function StoreNav() {
  const [featureFlags, cartItems, session] = await Promise.all([
    getRuntimeFeatureFlags(),
    getCartItems(),
    getSession(),
  ]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const canOpenAdmin = session ? isAdminSession(session) : false;
  const navigation = getNavigation(featureFlags).map((item) =>
    item.href === "/cart" && cartCount > 0
      ? { ...item, label: `Корзина (${cartCount})` }
      : item,
  );

  return (
    <nav className="nav glass">
      <Link href="/" className="nav-logo" aria-label={siteConfig.legalName}>
        <BrandLogo compact />
      </Link>
      <div className="nav-side">
        <div className="nav-links">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href as "/catalog"}>
              {item.label}
            </Link>
          ))}
          <Link href={"/profile" as Route}>
            {session ? "Профиль" : "Войти"}
          </Link>
        </div>
        {canOpenAdmin ? (
          <Link href="/admin" className="button button-secondary button-sm nav-admin-link">
            Админка
          </Link>
        ) : null}
      </div>
    </nav>
  );
}