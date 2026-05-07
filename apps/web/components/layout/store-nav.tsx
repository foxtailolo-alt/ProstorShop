import Link from "next/link";
import type { Route } from "next";
import { siteConfig } from "@prostor/core";
import { getSession, isAdminSession } from "../../lib/auth/session";
import { getCartItems } from "../../lib/cart";
import { getRuntimeFeatureFlags } from "../../lib/data/catalog";
import { getNavigation } from "../../lib/site";
import { BrandLogo } from "./brand-logo";
import { CartStatusLink } from "./cart-status-link";
import { StoreMobileDock } from "./store-mobile-dock";

export async function StoreNav() {
  const [featureFlags, cartItems, session] = await Promise.all([
    getRuntimeFeatureFlags(),
    getCartItems(),
    getSession(),
  ]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const canOpenAdmin = session ? isAdminSession(session) : false;
  const navigation = getNavigation(featureFlags);
  const mobileUtilityLinks = navigation.filter((item) => item.href === "/trade-in" || item.href === "/service");

  return (
    <>
      <nav className="nav glass">
        <Link href="/" className="nav-logo" aria-label={siteConfig.legalName}>
          <BrandLogo compact />
        </Link>
        <div className="nav-side">
          <div className="nav-links">
            {navigation.map((item) => item.href === "/cart" ? (
              <CartStatusLink key={item.href} initialCartCount={cartCount} />
            ) : (
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
        {mobileUtilityLinks.length > 0 ? (
          <div className="nav-mobile-links" aria-label="Быстрые разделы">
            {mobileUtilityLinks.map((item) => (
              <Link key={item.href} href={item.href as "/trade-in"}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </nav>
      <StoreMobileDock cartCount={cartCount} isAuthenticated={Boolean(session)} />
    </>
  );
}