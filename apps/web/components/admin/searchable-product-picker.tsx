"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProductOption = {
  id: string;
  name: string;
  brand: string;
  price: number;
};

type SearchableProductPickerProps = {
  name: string;
  products: ProductOption[];
  placeholder?: string;
};

export function SearchableProductPicker({
  name,
  products,
  placeholder = "Выберите товар...",
}: SearchableProductPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return products.slice(0, 100);
    }

    return products.filter((product) => (
      `${product.name} ${product.brand}`.toLowerCase().includes(normalized)
    ));
  }, [products, query]);

  const selectedProduct = selectedId
    ? products.find((product) => product.id === selectedId) ?? null
    : null;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const targetNode = event.target as Node;

      if (!rootRef.current?.contains(targetNode) && !menuRef.current?.contains(targetNode)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateMenuPosition() {
      const rect = inputRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setMenuStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`searchable-product-picker ${open ? "searchable-product-picker-open" : ""}`}
    >
      <input type="hidden" name={name} value={selectedId} />
      <input
        ref={inputRef}
        type="text"
        value={selectedProduct ? `${selectedProduct.name} — ${selectedProduct.price.toLocaleString("ru-RU")} ₽` : query}
        placeholder={placeholder}
        className="searchable-product-picker-input"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setSelectedId("");
          setQuery(event.target.value);
          setOpen(true);
        }}
      />

      {open && menuStyle ? createPortal(
        <div
          ref={menuRef}
          className="searchable-product-picker-menu searchable-product-picker-menu-portal"
          style={{
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
          }}
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className={`searchable-product-picker-option ${selectedId === product.id ? "searchable-product-picker-option-active" : ""}`}
                onClick={() => {
                  setSelectedId(product.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="searchable-product-picker-option-name">{product.name}</span>
                <span className="searchable-product-picker-option-meta">
                  {product.brand} • {product.price.toLocaleString("ru-RU")} ₽
                </span>
              </button>
            ))
          ) : (
            <div className="searchable-product-picker-empty">Ничего не найдено</div>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}