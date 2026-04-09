import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreNav } from "../../../components/layout/store-nav";
import { getAttributionEntries, getAttributionSnapshot } from "../../../lib/attribution";
import { findCatalogProductBySlug, getRuntimeFeatureFlags } from "../../../lib/data/catalog";
import { addToCartAction } from "../cart/actions";

type MiniAppPageProps = {
  searchParams?: Promise<{
    added?: string;
    product?: string;
    source?: string;
    tgWebAppStartParam?: string;
  }>;
};

export default async function MiniAppPage({ searchParams }: MiniAppPageProps) {
  const [featureFlags, attribution] = await Promise.all([
    getRuntimeFeatureFlags(),
    getAttributionSnapshot(),
  ]);

  if (!featureFlags.telegramMiniAppEnabled) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const addedProductSlug = resolvedSearchParams?.added?.trim();
  const directProductSlug = resolvedSearchParams?.tgWebAppStartParam?.trim();
  const productSlug = resolvedSearchParams?.product?.trim() ?? directProductSlug;
  const source = resolvedSearchParams?.source?.trim() ?? (directProductSlug ? "telegram-post" : undefined);
  const product = productSlug ? await findCatalogProductBySlug(productSlug) : null;
  const addedSameProduct = Boolean(product && addedProductSlug === product.slug);
  const attributionEntries = getAttributionEntries(attribution);
  const redirectTo = product
    ? `/mini-app?product=${product.slug}${source ? `&source=${encodeURIComponent(source)}` : ""}`
    : "/mini-app";

  return (
    <main className="page shell">
      <StoreNav />
      <section className="hero glass">
        <div className="section-label">Telegram Mini App</div>
        <h1>{product ? product.name : "Mini App будет вторым входом в ту же витрину."}</h1>
        <p>
          {product
            ? product.summary
            : "Это сохранит единые товары, правила, фильтры, заявки, аналитику и снизит стоимость поддержки."}
        </p>
        <div className="actions">
          {source ? <div className="pill">Источник: {source}</div> : null}
          {product ? <div className="pill">{product.price.toLocaleString("ru-RU")} ₽</div> : null}
          {product ? <div className="pill">{product.inStock ? "В наличии" : "Под заказ"}</div> : null}
          {attributionEntries.map((entry) => (
            <div key={entry.label} className="pill">
              {entry.label}: {entry.value}
            </div>
          ))}
        </div>
      </section>

      {addedSameProduct && product ? (
        <section style={{ marginTop: 18 }} className="card glass">
          <div className="section-label">Добавлено в корзину</div>
          <p>{product.name} уже в общей корзине. Дальше можно продолжить подбор или сразу оформить заявку.</p>
          <div className="actions">
            <Link className="button button-primary" href="/cart">
              Открыть корзину
            </Link>
            <Link className="button button-secondary" href="/catalog">
              Продолжить выбор
            </Link>
          </div>
        </section>
      ) : null}

      {product ? (
        <>
          <section style={{ marginTop: 18 }} className="grid grid-2 product-hero-grid">
            <article className="card glass">
              <div className="section-label">Карточка из поста</div>
              <h2>{product.brand}</h2>
              <p>
                Mini App уже открывает конкретный товар из Telegram-поста без отдельного каталога и
                без дублирования данных.
              </p>
              <div className="grid">
                {product.highlights.map((item) => (
                  <div key={item} className="pill">
                    {item}
                  </div>
                ))}
              </div>
            </article>
            <article className="card glass">
              <div className="product-media product-media-large">
                {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="product-media-fallback" />}
              </div>
            </article>
          </section>

          <section style={{ marginTop: 18 }} className="card glass">
            <div className="section-label">Переходы</div>
            <div className="actions">
              <form action={addToCartAction}>
                <input type="hidden" name="productSlug" value={product.slug} />
                <input type="hidden" name="quantity" value="1" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button className="button button-primary" type="submit">
                  Добавить в корзину
                </button>
              </form>
              <Link className="button button-secondary" href="/cart">
                Корзина
              </Link>
              <Link className="button button-primary" href={`/catalog/${product.categorySlug}/${product.slug}`}>
                Открыть полную карточку
              </Link>
              <Link className="button button-secondary" href="/catalog">
                Открыть каталог
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section style={{ marginTop: 18 }} className="card glass">
          <div className="section-label">Единый вход</div>
          <p>
            Mini App использует тот же каталог, что и сайт. Когда пользователь приходит из Telegram,
            сюда можно передать slug товара и источник перехода.
          </p>
        </section>
      )}
    </main>
  );
}