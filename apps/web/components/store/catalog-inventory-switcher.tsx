"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type TouchEvent } from "react";
import type { CategoryTreeNode } from "../../lib/data/catalog";

type CatalogInventorySwitcherProps = {
  tree: CategoryTreeNode[];
};

type InventoryTab = {
  id: "new" | "trade-in";
  label: string;
  description: string;
  root: CategoryTreeNode;
};

function countTreeProducts(node: CategoryTreeNode): number {
  return node.productCount + node.children.reduce((sum, child) => sum + countTreeProducts(child), 0);
}

export function CatalogInventorySwitcher({ tree }: CatalogInventorySwitcherProps) {
  const tabs = useMemo<InventoryTab[]>(() => {
    const newRoot = tree.find((node) => !node.slug.startsWith("trade-in"));
    const tradeInRoot = tree.find((node) => node.slug.startsWith("trade-in"));
    const nextTabs: InventoryTab[] = [];

    if (newRoot) {
      nextTabs.push({
        id: "new",
        label: "Новое",
        description: "Новые устройства и актуальные категории каталога.",
        root: newRoot,
      });
    }

    if (tradeInRoot) {
      nextTabs.push({
        id: "trade-in",
        label: "Trade-in",
        description: "Подкатегории доступных trade-in устройств.",
        root: tradeInRoot,
      });
    }

    return nextTabs;
  }, [tree]);

  const [activeTabId, setActiveTabId] = useState<InventoryTab["id"]>(() => {
    if (tabs.some((tab) => tab.id === "new")) {
      return "new";
    }

    return tabs[0]?.id ?? "new";
  });
  const [hoveredCategorySlug, setHoveredCategorySlug] = useState<string | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTabId));
  const activeTab = tabs[activeIndex] ?? null;

  if (!activeTab) {
    return (
      <div className="empty-state glass">
        <p>Категории каталога пока не настроены.</p>
      </div>
    );
  }

  const visibleCategories = activeTab.root.children.length > 0 ? activeTab.root.children : [activeTab.root];

  const switchToIndex = (index: number) => {
    if (index < 0 || index >= tabs.length) {
      return;
    }

    setActiveTabId(tabs[index]!.id);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? 0;
    touchStartYRef.current = event.touches[0]?.clientY ?? 0;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const deltaX = touchStartXRef.current - (event.changedTouches[0]?.clientX ?? 0);
    const deltaY = touchStartYRef.current - (event.changedTouches[0]?.clientY ?? 0);

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    switchToIndex(deltaX > 0 ? activeIndex + 1 : activeIndex - 1);
  };

  return (
    <div className="catalog-switcher">
      {tabs.length > 1 ? (
        <div className="catalog-switcher-tabs glass" role="tablist" aria-label="Тип каталога">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab.id}
              className={`catalog-switcher-tab ${tab.id === activeTab.id ? "is-active" : ""}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="catalog-switcher-panel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="catalog-switcher-header animate-fade-up">
          <div>
            <h2 className="store-section-title">{activeTab.label}</h2>
          </div>
        </div>

        <div className="grid grid-5">
          {visibleCategories.map((category, index) => {
            const totalProducts = countTreeProducts(category);

            return (
              <article
                key={category.slug}
                className={`category-card glass animate-fade-up delay-${Math.min(index + 1, 8)}`}
                onMouseEnter={() => setHoveredCategorySlug(category.slug)}
                onMouseLeave={() => setHoveredCategorySlug((currentSlug) => currentSlug === category.slug ? null : currentSlug)}
              >
                <Link href={`/catalog/${category.slug}`} className="category-card-link">
                  {category.imageUrl ? (
                    <div className="category-card-media">
                      <img src={category.imageUrl} alt={category.name} className="category-card-image" loading="lazy" />
                    </div>
                  ) : (
                    <span className="category-card-icon">📦</span>
                  )}
                  <span className="category-card-name">{category.name}</span>
                  <span className="category-card-count">
                    {category.children.length > 0
                      ? `${category.children.length} подкатегорий`
                      : `${totalProducts} товаров`}
                  </span>
                </Link>

                {category.children.length > 0 && hoveredCategorySlug === category.slug ? (
                  <div className="category-card-subcategories">
                    {category.children.map((child) => (
                      <Link key={child.id} href={`/catalog/${child.slug}`} className="category-card-subcategory-link">
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}