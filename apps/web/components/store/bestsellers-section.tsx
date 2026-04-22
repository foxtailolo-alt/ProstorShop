import Link from "next/link";
import { ProductCardMedia } from "../product/product-card-media";
import type { HomepageSectionItem } from "../../lib/data/catalog";

type Props = {
  title: string;
  items: HomepageSectionItem[];
  addToCartAction: (fd: FormData) => Promise<void>;
};

export function BestsellersSection({ title, items, addToCartAction }: Props) {
  const highlighted = items.find((i) => i.isHighlighted && i.product);
  const rest = items.filter((i) => i !== highlighted && i.product);

  if (!highlighted?.product && rest.length === 0) return null;

  return (
    <section className="store-section">
      <h2 className="store-section-title animate-fade-up">{title}</h2>

      <div className="bestsellers-grid">
        {/* Big highlighted card */}
        {highlighted?.product && (
          <article className="product-card product-card-hero glass animate-fade-up delay-1">
            <Link href={`/catalog/${highlighted.product.categorySlug}/${highlighted.product.slug}`}>
              <ProductCardMedia
                images={highlighted.product.imageUrls.length ? highlighted.product.imageUrls : highlighted.product.imageUrl ? [highlighted.product.imageUrl] : []}
                productName={highlighted.product.name}
                badge={highlighted.product.badge}
              />
            </Link>
            <div className="product-card-body">
              <span className="product-card-brand">{highlighted.product.brand}</span>
              <Link href={`/catalog/${highlighted.product.categorySlug}/${highlighted.product.slug}`} className="product-card-name">
                {highlighted.product.name}
              </Link>
              <div className="product-card-price-row">
                <span className="product-card-price">{highlighted.product.price.toLocaleString("ru-RU")} ₽</span>
                {highlighted.product.compareAtPrice ? (
                  <span className="product-card-old-price">{highlighted.product.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                ) : null}
              </div>
              <div className="product-card-stock">
                {highlighted.product.inStock ? "✓ В наличии" : "Под заказ"}
              </div>
              <form action={addToCartAction} className="product-card-actions">
                <input type="hidden" name="productSlug" value={highlighted.product.slug} />
                <input type="hidden" name="quantity" value="1" />
                <input type="hidden" name="redirectTo" value="/" />
                <button className="button button-primary button-sm" type="submit">В корзину</button>
              </form>
            </div>
          </article>
        )}

        {/* Smaller cards grid */}
        <div className="bestsellers-rest">
          {rest.map((item, i) => {
            const p = item.product!;
            return (
              <article key={item.id} className={`product-card glass animate-fade-up delay-${Math.min(i + 2, 6)}`}>
                <Link href={`/catalog/${p.categorySlug}/${p.slug}`}>
                  <ProductCardMedia
                    images={p.imageUrls.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : []}
                    productName={p.name}
                    badge={p.badge}
                  />
                </Link>
                <div className="product-card-body">
                  <span className="product-card-brand">{p.brand}</span>
                  <Link href={`/catalog/${p.categorySlug}/${p.slug}`} className="product-card-name">
                    {p.name}
                  </Link>
                  <div className="product-card-price-row">
                    <span className="product-card-price">{p.price.toLocaleString("ru-RU")} ₽</span>
                    {p.compareAtPrice ? (
                      <span className="product-card-old-price">{p.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                    ) : null}
                  </div>
                  <div className="product-card-stock">
                    {p.inStock ? "✓ В наличии" : "Под заказ"}
                  </div>
                  <form action={addToCartAction} className="product-card-actions">
                    <input type="hidden" name="productSlug" value={p.slug} />
                    <input type="hidden" name="quantity" value="1" />
                    <input type="hidden" name="redirectTo" value="/" />
                    <button className="button button-primary button-sm" type="submit">В корзину</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
