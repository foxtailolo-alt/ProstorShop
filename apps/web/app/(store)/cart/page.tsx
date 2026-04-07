import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreNav } from "../../../components/layout/store-nav";
import { getCartItems } from "../../../lib/cart";
import { getSession } from "../../../lib/auth/session";
import { getRuntimeFeatureFlags, listCatalogProducts } from "../../../lib/data/catalog";
import { clearCartAction, removeCartItemAction, submitOrderAction, updateCartItemAction } from "./actions";

type CartPageProps = {
  searchParams?: Promise<{
    added?: string;
    success?: string;
    orderId?: string;
  }>;
};

export default async function CartPage({ searchParams }: CartPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const addedProductSlug = resolvedSearchParams?.added?.trim();
  const success = resolvedSearchParams?.success === "1";
  const orderId = resolvedSearchParams?.orderId?.trim();

  const [featureFlags, session, cartItems, products] = await Promise.all([
    getRuntimeFeatureFlags(),
    getSession(),
    getCartItems(),
    listCatalogProducts(),
  ]);
  const defaultName = [session?.user.firstName, session?.user.lastName].filter(Boolean).join(" ") || session?.user.username || "";
  const cartProductMap = new Map(products.map((product) => [product.slug, product]));
  const cartEntries = cartItems
    .map((item) => {
      const product = cartProductMap.get(item.productSlug);
      return product
        ? {
            product,
            quantity: item.quantity,
            subtotal: product.price * item.quantity,
          }
        : null;
    })
    .filter((entry): entry is { product: NonNullable<(typeof products)[number]>; quantity: number; subtotal: number } => Boolean(entry));
  const total = cartEntries.reduce((sum, entry) => sum + entry.subtotal, 0);
  const addedProduct = addedProductSlug ? cartProductMap.get(addedProductSlug) : null;

  if (!featureFlags.checkoutEnabled) {
    notFound();
  }

  if (success) {
    return (
      <main className="page shell">
        <StoreNav />
        <section className="store-section">
          <div className="success-banner glass">
            <h1>Заказ оформлен!</h1>
            <p>Номер заказа: {orderId ?? "—"}. Мы свяжемся с вами для подтверждения.</p>
            <Link className="button button-primary" href="/catalog">Продолжить покупки</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Корзина</h1>
      </section>

      {addedProduct ? (
        <section className="store-section">
          <div className="added-notice glass">
            <span>✓ {addedProduct.name} добавлен в корзину</span>
            <Link className="button button-secondary button-sm" href="/catalog">
              Продолжить покупки
            </Link>
          </div>
        </section>
      ) : null}

      {cartEntries.length > 0 ? (
        <section className="store-section">
          <div className="cart-layout">
            <div className="cart-items">
              {cartEntries.map(({ product, quantity, subtotal }) => (
                <div key={product.slug} className="cart-item glass">
                  <Link href={`/catalog/${product.categorySlug}/${product.slug}`} className="cart-item-media">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} loading="lazy" />
                    ) : (
                      <div className="product-media-fallback" />
                    )}
                  </Link>
                  <div className="cart-item-info">
                    <Link href={`/catalog/${product.categorySlug}/${product.slug}`} className="cart-item-name">
                      {product.name}
                    </Link>
                    <span className="cart-item-price">{product.price.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  <div className="cart-item-controls">
                    <form action={updateCartItemAction} className="cart-qty-form">
                      <input type="hidden" name="productSlug" value={product.slug} />
                      <input name="quantity" type="number" min="1" step="1" defaultValue={String(quantity)} className="cart-qty-input" />
                      <button className="button button-secondary button-sm" type="submit">Обновить</button>
                    </form>
                    <form action={removeCartItemAction}>
                      <input type="hidden" name="productSlug" value={product.slug} />
                      <button className="button button-secondary button-sm" type="submit">Удалить</button>
                    </form>
                  </div>
                  <div className="cart-item-subtotal">
                    {subtotal.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              ))}

              <div className="cart-total-row">
                <form action={clearCartAction}>
                  <button className="button button-secondary button-sm" type="submit">Очистить корзину</button>
                </form>
                <div className="cart-total">
                  <span>Итого:</span>
                  <strong>{total.toLocaleString("ru-RU")} ₽</strong>
                </div>
              </div>
            </div>

            <div className="cart-checkout glass">
              <h2>Оформить заказ</h2>
              <form action={submitOrderAction} className="checkout-form">
                <label className="field">
                  <span>Имя</span>
                  <input name="customerName" type="text" defaultValue={defaultName} placeholder="Ваше имя" required />
                </label>
                <label className="field">
                  <span>Телефон</span>
                  <input name="phone" type="tel" placeholder="+7 900 000-00-00" required />
                </label>
                <label className="field">
                  <span>Комментарий</span>
                  <textarea name="note" rows={3} placeholder="Цвет, память, удобное время звонка" />
                </label>
                <div className="checkout-summary">
                  <span>Позиций: {cartEntries.length}</span>
                  <strong>{total.toLocaleString("ru-RU")} ₽</strong>
                </div>
                <button className="button button-primary button-lg" type="submit">
                  Оформить заказ
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : (
        <section className="store-section">
          <div className="empty-state glass">
            <p>Ваша корзина пуста</p>
            <Link className="button button-primary" href="/catalog">Перейти в каталог</Link>
          </div>
        </section>
      )}
    </main>
  );
}