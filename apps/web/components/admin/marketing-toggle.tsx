"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type MarketingToggleProps = {
  enabled: boolean;
};

export function MarketingToggle({ enabled }: MarketingToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const nextValue = enabled ? "" : "1";
    document.cookie = `prostor_marketing=${nextValue}; path=/; max-age=${nextValue ? 60 * 60 * 24 * 365 : 0}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      className={`button button-sm ${enabled ? "button-primary" : "button-secondary"}`}
      onClick={toggle}
      disabled={isPending}
      title={enabled ? "Маркетинг-режим включён" : "Включить маркетинг-режим"}
      style={{ whiteSpace: "nowrap" }}
    >
      📊 {enabled ? "Маркетинг ✓" : "Маркетинг"}
    </button>
  );
}
