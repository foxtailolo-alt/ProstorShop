import Link from "next/link";
import { siteConfig } from "@prostor/core";
import { getCartItems } from "../../lib/cart";
import { getRuntimeFeatureFlags } from "../../lib/data/catalog";
import { getNavigation } from "../../lib/site";

export async function StoreNav() {
  const [featureFlags, cartItems] = await Promise.all([
    getRuntimeFeatureFlags(),
    getCartItems(),
  ]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const navigation = getNavigation(featureFlags).map((item) =>
    item.href === "/cart" && cartCount > 0
      ? { ...item, label: `Корзина (${cartCount})` }
      : item,
  );

  return (
    <nav className="nav glass">
      <Link href="/" className="nav-logo">{siteConfig.legalName}</Link>
      <div className="nav-side">
        <div className="nav-links">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href as "/catalog"}>
              {item.label}
            </Link>
          ))}
        </div>
        <Link href="/admin" className="button button-secondary button-sm nav-admin-link">
          Админка
        </Link>
      </div>
    </nav>
  );
}