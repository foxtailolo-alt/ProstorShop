"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type StoreMobileDockProps = {
  cartCount: number;
  isAuthenticated: boolean;
};

const dockItems = [
  {
    href: "/",
    label: "Главная",
    match: (pathname: string) => pathname === "/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.8 12 4l8 6.8v8.2a1 1 0 0 1-1 1h-4.8v-5.4H9.8V20H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/catalog",
    label: "Каталог",
    match: (pathname: string) => pathname.startsWith("/catalog"),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 5.5h12M6 12h12M6 18.5h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Профиль",
    match: (pathname: string) => pathname.startsWith("/profile") || pathname.startsWith("/login"),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/cart",
    label: "Корзина",
    match: (pathname: string) => pathname.startsWith("/cart"),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h2l1.4 8.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="19" r="1.3" fill="currentColor" />
        <circle cx="17" cy="19" r="1.3" fill="currentColor" />
      </svg>
    ),
  },
];

export function StoreMobileDock({ cartCount, isAuthenticated }: StoreMobileDockProps) {
  const pathname = usePathname();
  const [liveCartCount, setLiveCartCount] = useState(cartCount);
  const [isBumping, setIsBumping] = useState(false);

  useEffect(() => {
    setLiveCartCount(cartCount);
  }, [cartCount]);

  useEffect(() => {
    function handleCartUpdated(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;

      if (typeof detail?.count === "number") {
        setLiveCartCount(detail.count);
      }
    }

    function handleCartBump() {
      setIsBumping(true);
      window.setTimeout(() => setIsBumping(false), 520);
    }

    window.addEventListener("prostor:cart-updated", handleCartUpdated);
    window.addEventListener("prostor:cart-bump", handleCartBump);

    return () => {
      window.removeEventListener("prostor:cart-updated", handleCartUpdated);
      window.removeEventListener("prostor:cart-bump", handleCartBump);
    };
  }, []);

  return (
    <nav className="mobile-dock glass" aria-label="Мобильная навигация">
      {dockItems.map((item) => {
        const active = item.match(pathname);
        const label = item.href === "/profile" ? (isAuthenticated ? "Профиль" : "Войти") : item.label;

        return (
          <Link
            key={item.href}
            href={item.href as Route}
            className={`mobile-dock-link${active ? " mobile-dock-link-active" : ""}${item.href === "/cart" && isBumping ? " cart-link-bump" : ""}`}
            data-cart-link-target={item.href === "/cart" ? "mobile" : undefined}
          >
            <span className="mobile-dock-icon-wrap">
              <span className="mobile-dock-icon">{item.icon}</span>
              {item.href === "/cart" && liveCartCount > 0 ? <span className="mobile-dock-badge">{liveCartCount}</span> : null}
            </span>
            <span className="mobile-dock-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}