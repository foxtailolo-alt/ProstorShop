"use client";

import { startTransition, useRef, useState } from "react";

type AddToCartResult = {
  cartCount: number;
  productSlug: string;
};

type AddToCartButtonProps = {
  addToCartAction: (formData: FormData) => Promise<AddToCartResult>;
  productSlug: string;
  productName: string;
  quantity?: number;
  variantLabel?: string;
  className?: string;
  label?: string;
  pendingLabel?: string;
  successLabel?: string;
  disabled?: boolean;
};

function isVisibleElement(element: Element | null): element is HTMLElement {
  return Boolean(element) && element instanceof HTMLElement && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
}

function getCartTarget() {
  const candidates = Array.from(document.querySelectorAll("[data-cart-link-target]"));
  return candidates.find(isVisibleElement) ?? null;
}

function runFlyToCartAnimation(sourceImage: HTMLImageElement | null, target: HTMLElement | null) {
  if (!sourceImage || !target) {
    return;
  }

  const sourceRect = sourceImage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  if (sourceRect.width === 0 || sourceRect.height === 0 || targetRect.width === 0 || targetRect.height === 0) {
    return;
  }

  const clone = sourceImage.cloneNode(true) as HTMLImageElement;
  clone.style.position = "fixed";
  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.objectFit = "cover";
  clone.style.borderRadius = "24px";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = "9999";
  clone.style.boxShadow = "0 24px 80px rgba(15, 23, 42, 0.22)";
  document.body.appendChild(clone);

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
  const scale = Math.max(0.14, Math.min(targetRect.width / sourceRect.width, targetRect.height / sourceRect.height));

  const animation = clone.animate([
    {
      transform: "translate3d(0, 0, 0) scale(1)",
      opacity: 1,
      filter: "saturate(1) blur(0px)",
    },
    {
      transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`,
      opacity: 0.18,
      filter: "saturate(1.1) blur(1px)",
    },
  ], {
    duration: 720,
    easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
    fill: "forwards",
  });

  animation.addEventListener("finish", () => {
    clone.remove();
  }, { once: true });
}

export function AddToCartButton({
  addToCartAction,
  productSlug,
  productName,
  quantity = 1,
  variantLabel,
  className = "button button-primary button-sm",
  label = "Добавить в корзину",
  pendingLabel = "Добавляем...",
  successLabel = "В корзине",
  disabled = false,
}: AddToCartButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAdd() {
    if (disabled || isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    const sourceRoot = buttonRef.current?.closest("[data-cart-source-root]") ?? null;
    const sourceImage = sourceRoot?.querySelector("img") ?? null;
    const cartTarget = getCartTarget();

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("productSlug", productSlug);
        formData.set("quantity", String(quantity));

        if (variantLabel?.trim()) {
          formData.set("variant", variantLabel.trim());
        }

        const result = await addToCartAction(formData);
        runFlyToCartAnimation(sourceImage instanceof HTMLImageElement ? sourceImage : null, cartTarget);
        window.dispatchEvent(new CustomEvent("prostor:cart-updated", { detail: { count: result.cartCount } }));
        window.dispatchEvent(new CustomEvent("prostor:cart-bump", { detail: { productName } }));
        setIsSuccess(true);
        window.setTimeout(() => setIsSuccess(false), 1400);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось добавить товар в корзину.");
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <div className="add-to-cart-inline">
      <button ref={buttonRef} className={`${className}${isSuccess ? " cart-button-success" : ""}`} type="button" onClick={handleAdd} disabled={disabled || isPending}>
        {isPending ? <span className="button-spinner" aria-hidden="true" /> : null}
        {isPending ? pendingLabel : isSuccess ? successLabel : label}
      </button>
      {errorMessage ? <span className="add-to-cart-error">{errorMessage}</span> : null}
    </div>
  );
}