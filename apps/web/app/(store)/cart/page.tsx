import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreNav } from "../../../components/layout/store-nav";
import { getCartItems } from "../../../lib/cart";
import { getSession } from "../../../lib/auth/session";
import { findCatalogProductBySlug, getRuntimeFeatureFlags } from "../../../lib/data/catalog";
import { buildCartEntriesWithPricing } from "../../../lib/cart-pricing";
import { formatOrderNumber } from "../../../lib/order-number";
import { getAppliedPromoCode, getPromoCodeSummary } from "../../../lib/promo";
import { applyPromoCodeAction, clearCartAction, clearPromoCodeAction, removeCartItemAction, submitOrderAction, updateCartItemAction } from "./actions";

type CartPageProps = {
  searchParams?: Promise<{
    added?: string;
    success?: string;
    orderId?: string;
    orderNumber?: string;
    promo?: string;
    promoError?: string;
  }>;
};

export default async function CartPage({ searchParams }: CartPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const addedProductSlug = resolvedSearchParams?.added?.trim();
  const success = resolvedSearchParams?.success === "1";
  const orderId = resolvedSearchParams?.orderId?.trim();
  const orderNumber = resolvedSearchParams?.orderNumber?.trim();
  const promoMessage = resolvedSearchParams?.promo?.trim();
  const promoError = resolvedSearchParams?.promoError?.trim();

  const [featureFlags, session, cartItems, products, appliedPromoCodeValue] = await Promise.all([
    getRuntimeFeatureFlags(),
    getSession(),
    getCartItems(),
    Promise.all([...new Set((await getCartItems()).map((item) => item.productSlug))].map((slug) => findCatalogProductBySlug(slug))),
    getAppliedPromoCode(),
  ]);
  const defaultName = [session?.user.firstName, session?.user.lastName].filter(Boolean).join(" ") || session?.user.username || "";
  const defaultPhone = session?.user.phone || "";
  const resolvedProducts = products.filter((product): product is NonNullable<(typeof products)[number]> => Boolean(product));
  const cartProductMap = new Map(resolvedProducts.map((product) => [product.slug, product]));
  const cartEntries = buildCartEntriesWithPricing({ cartItems, products: resolvedProducts });
  const total = cartEntries.reduce((sum, entry) => sum + entry.subtotal, 0);
  const accessorySavings = cartEntries.reduce((sum, entry) => sum + ((entry.compareAtUnitPrice ?? entry.effectiveUnitPrice) - entry.effectiveUnitPrice) * entry.quantity, 0);
  const hasAccessoryWithoutDeviceDiscount = cartEntries.some((entry) => entry.isAccessory) && !cartEntries.some((entry) => !entry.isAccessory);
  const addedProduct = addedProductSlug ? cartProductMap.get(addedProductSlug) : null;
  const appliedPromoCode = appliedPromoCodeValue
    ? await getPromoCodeSummary(appliedPromoCodeValue, session?.user.id ?? null).catch(() => null)
    : null;

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
            <p>
              Номер заказа: {orderNumber ?? (orderId ? formatOrderNumber({ id: orderId, createdAt: new Date() }) : "—")}. Мы свяжемся с вами для подтверждения.
            </p>
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
              {cartEntries.map(({ item, product, quantity, effectiveUnitPrice, subtotal, isAccessory, hasBundleDiscount, compareAtUnitPrice, bundleDiscountPercent }) => (
                <div key={item.itemKey} className="cart-item glass">
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
                    {item.variantLabel ? <span className="muted">{item.variantLabel}</span> : null}
                    {hasBundleDiscount ? (
                      <>
                        <span className="cart-item-price cart-item-price-old">{compareAtUnitPrice?.toLocaleString("ru-RU")} ₽</span>
                        <div className="cart-item-offer-line">
                          <span className="cart-item-discount-pill">-{bundleDiscountPercent}% на аксессуар</span>
                          <span className="cart-item-price-strong">{effectiveUnitPrice.toLocaleString("ru-RU")} ₽</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="cart-item-price">{effectiveUnitPrice.toLocaleString("ru-RU")} ₽</span>
                        {isAccessory ? <span className="cart-item-bundle-hint">Скидка 20% включится после добавления устройства</span> : null}
                      </>
                    )}
                  </div>
                  <div className="cart-item-controls">
                    <form action={updateCartItemAction} className="cart-qty-form">
                      <input type="hidden" name="itemKey" value={item.itemKey} />
                      <input name="quantity" type="number" min="1" step="1" defaultValue={String(quantity)} className="cart-qty-input" />
                      <button className="button button-secondary button-sm" type="submit">Обновить</button>
                    </form>
                    <form action={removeCartItemAction}>
                      <input type="hidden" name="itemKey" value={item.itemKey} />
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
              {accessorySavings > 0 ? <div className="cart-bundle-summary">Экономия на аксессуарах: {accessorySavings.toLocaleString("ru-RU")} ₽</div> : null}
              {hasAccessoryWithoutDeviceDiscount ? <div className="cart-bundle-summary">Добавьте любое устройство, чтобы активировать скидку 20% на аксессуары.</div> : null}
            </div>

            <div className="cart-checkout glass">
              <h2>Оформить заказ</h2>
              <div className="checkout-promo-box">
                <form action={applyPromoCodeAction} className="checkout-form">
                  <label className="field">
                    <span>Промокод</span>
                    <input name="promoCode" type="text" defaultValue={appliedPromoCode?.code ?? ""} placeholder="Введите промокод" />
                  </label>
                  <div className="actions field-wide">
                    <button className="button button-secondary button-sm" type="submit">Применить</button>
                  </div>
                </form>
                {appliedPromoCode ? (
                  <form action={clearPromoCodeAction}>
                    <button className="button button-secondary button-sm" type="submit">Убрать</button>
                  </form>
                ) : null}
                {appliedPromoCode ? (
                  <div className="muted">
                    Активен код <strong>{appliedPromoCode.code}</strong>
                    {appliedPromoCode.rewardDescription ? `: ${appliedPromoCode.rewardDescription}` : ""}
                  </div>
                ) : null}
                {promoMessage === "applied" ? <div className="muted">Промокод применён.</div> : null}
                {promoMessage === "cleared" ? <div className="muted">Промокод убран.</div> : null}
                {promoError ? <div className="muted">{promoError}</div> : null}
              </div>
              <form action={submitOrderAction} className="checkout-form">
                <label className="field">
                  <span>Имя</span>
                  <input name="customerName" type="text" defaultValue={defaultName} placeholder="Ваше имя" required />
                </label>
                <label className="field">
                  <span>Телефон</span>
                  <input name="phone" type="tel" defaultValue={defaultPhone} placeholder="+7 900 000-00-00" required />
                </label>
                <label className="field">
                  <span>Комментарий</span>
                  <textarea name="note" rows={3} placeholder="Цвет, память, удобное время звонка" />
                </label>
                <div className="checkout-summary">
                  <span>Позиций: {cartEntries.length}</span>
                  <strong>{total.toLocaleString("ru-RU")} ₽</strong>
                </div>
                {accessorySavings > 0 ? <div className="muted">Скидка на аксессуары: −{accessorySavings.toLocaleString("ru-RU")} ₽</div> : null}
                {appliedPromoCode?.rewardDescription ? (
                  <div className="muted">Бонус к заказу: {appliedPromoCode.rewardDescription}</div>
                ) : null}
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