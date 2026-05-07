"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CartStatusLinkProps = {
  initialCartCount: number;
};

export function CartStatusLink({ initialCartCount }: CartStatusLinkProps) {
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [isBumping, setIsBumping] = useState(false);

  useEffect(() => {
    function handleCartUpdated(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;

      if (typeof detail?.count === "number") {
        setCartCount(detail.count);
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
    <Link href="/cart" className={isBumping ? "cart-link-bump" : undefined} data-cart-link-target="desktop">
      {cartCount > 0 ? `Корзина (${cartCount})` : "Корзина"}
    </Link>
  );
}