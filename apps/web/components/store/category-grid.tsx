"use client";

import Link from "next/link";
import { useState } from "react";

type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
  children: CategoryNode[];
};

const bigSlugs = new Set(["iphone", "samsung"]);

export function CategoryGrid({ categories }: { categories: CategoryNode[] }) {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  return (
    <section className="store-section">
      <h2 className="store-section-title animate-fade-up">Категории</h2>
      <div className="catgrid">
        {categories.map((cat, i) => {
          const isBig = bigSlugs.has(cat.slug);
          return (
            <div
              key={cat.id}
              className={`catgrid-item ${isBig ? "catgrid-item-big" : ""} glass animate-fade-up delay-${Math.min(i + 1, 6)}`}
              onMouseEnter={() => setHoveredSlug(cat.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
            >
              <Link href={`/catalog/${cat.slug}`} className="catgrid-link">
                <div className="catgrid-media">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={cat.name} className="catgrid-img" loading="lazy" />
                  ) : (
                    <div className="catgrid-img-placeholder" />
                  )}
                </div>
                <div className="catgrid-info">
                  <span className="catgrid-name">{cat.name}</span>
                </div>
              </Link>

              {cat.children.length > 0 && hoveredSlug === cat.slug && (
                <div className="catgrid-sub">
                  {cat.children.map((sub) => (
                    <Link key={sub.id} href={`/catalog/${sub.slug}`} className="catgrid-sub-link">
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
