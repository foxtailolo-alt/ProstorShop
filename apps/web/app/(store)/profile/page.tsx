import Link from "next/link";
import { StoreNav } from "../../../components/layout/store-nav";
import { TelegramLoginWidget } from "../../../components/auth/telegram-login-widget";
import { PhoneLoginCard } from "../../../components/auth/phone-login-card";
import { formatOrderNumber } from "../../../lib/order-number";
import { getCurrentUserProfile } from "../../../lib/profile";
import { addPurchasedProfileDeviceAction } from "./actions";
import { deleteUsedDeviceWaitlistEntryAction, openProfileNotificationAction } from "../waitlist/actions";

const statusLabels: Record<string, string> = {
  pending: "Новая",
  contacted: "Связались",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена",
};

const deviceCategoryLabels: Record<string, string> = {
  iphone: "iPhone",
  mac: "Mac",
  samsung: "Samsung",
  ipad: "iPad",
  apple_watch: "Apple Watch",
};

const waitlistStatusLabels: Record<string, string> = {
  active: "Активно",
  matched: "Найден вариант",
  fulfilled: "Исполнено",
  cancelled: "Отменено",
};

const profileTabs = [
  { id: "overview", label: "Профиль" },
  { id: "devices", label: "Мои устройства" },
  { id: "offers", label: "Персональные предложения" },
  { id: "waitlist", label: "Лист ожидания" },
  { id: "orders", label: "История покупок" },
] as const;

type ProfileTab = (typeof profileTabs)[number]["id"];

function isProfileTab(value: string | undefined): value is ProfileTab {
  return profileTabs.some((tab) => tab.id === value);
}

function getDeviceTitle(device: NonNullable<Awaited<ReturnType<typeof getCurrentUserProfile>>>["userDevices"][number]) {
  return device.nickname?.trim() || `${device.brand} ${device.model}`;
}

function getPendingDeviceTitle(device: NonNullable<Awaited<ReturnType<typeof getCurrentUserProfile>>>["pendingPurchasedDevices"][number]) {
  return device.storage ? `${device.model} • ${device.storage}` : device.model;
}

type PendingPurchasedDevice = NonNullable<Awaited<ReturnType<typeof getCurrentUserProfile>>>["pendingPurchasedDevices"][number];

type ProfilePageProps = {
  searchParams?: Promise<{
    deviceAdded?: string;
    waitlistAdded?: string;
    tab?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const profile = await getCurrentUserProfile();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const deviceAdded = resolvedSearchParams?.deviceAdded === "1";
  const waitlistAdded = resolvedSearchParams?.waitlistAdded === "1";
  const activeTab: ProfileTab = isProfileTab(resolvedSearchParams?.tab) ? resolvedSearchParams.tab : "overview";
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || "Пользователь";
  const displayPhone = profile?.phone || profile?.orders.find((order) => order.phone)?.phone || "Добавится после первого заказа";
  const canOpenAdmin = Boolean(profile?.roles.some((role) => role !== "customer"));

  return (
    <main className="page shell">
      <StoreNav />
      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Профиль</h1>
      </section>

      {!profile ? (
        <section className="store-section">
          <div className="glass" style={{ padding: 24, display: "grid", gap: 16 }}>
            <h2>Вход в Простор</h2>
            <p className="muted">
              Авторизуйтесь, чтобы увидеть историю заказов, баланс баллов и свой реферальный промокод.
            </p>
            <div className="auth-row">
              <PhoneLoginCard redirectTo="/profile" />
              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="muted auth-divider-text">или</span>
                <div className="auth-divider-line" />
              </div>
              <TelegramLoginWidget redirectToDefault="/profile" />
            </div>
          </div>
        </section>
      ) : (
        <section className="store-section">
          {deviceAdded ? (
            <div className="profile-success-banner glass">
              <strong>Устройство добавлено в профиль.</strong>
              <span className="muted">Теперь для него сразу доступны оценка и рекомендации по апгрейду.</span>
            </div>
          ) : null}
          {waitlistAdded ? (
            <div className="profile-success-banner glass">
              <strong>Запрос добавлен в список ожидания.</strong>
              <span className="muted">Когда появится подходящий trade-in вариант, он будет связан с этой записью в вашем профиле.</span>
            </div>
          ) : null}

          <div className="glass profile-tabs-strip">
            <div className="profile-tab-list" role="tablist" aria-label="Разделы профиля">
              {profileTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.id === "overview" ? "/profile" : `/profile?tab=${tab.id}`}
                  className={`profile-tab ${activeTab === tab.id ? "is-active" : ""}`}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="profile-shell">
            <div className="glass" style={{ padding: 24, display: "grid", gap: 18 }}>
              <div>
                <h2 style={{ marginBottom: 6 }}>{displayName}</h2>
                <div className="muted">Телефон: {displayPhone}</div>
                {profile.username ? <div className="muted">@{profile.username}</div> : null}
              </div>

              <div className="glass" style={{ padding: 18, display: "grid", gap: 8 }}>
                <div className="section-label">Баланс</div>
                <strong style={{ fontSize: "2rem" }}>{profile.loyaltyPoints} баллов</strong>
                <div className="muted">За завершённые заказы начисляется 1% кешбэка баллами.</div>
              </div>

              <div className="glass" style={{ padding: 18, display: "grid", gap: 8 }}>
                <div className="section-label">Ваш промокод</div>
                <strong style={{ fontSize: "1.4rem" }}>{profile.referralPromoCode?.code ?? "Будет создан автоматически"}</strong>
                <div className="muted">
                  {profile.referralPromoCode?.rewardDescription ?? "Промокод появится после первой авторизации."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="button button-primary" href="/catalog">Перейти в каталог</Link>
                {canOpenAdmin ? <Link className="button button-secondary" href="/admin">Открыть админку</Link> : null}
                <form action="/api/auth/logout" method="post">
                  <button className="button button-secondary" type="submit">Выйти</button>
                </form>
              </div>
            </div>

            <div className="glass profile-tabs-panel">
              <div className="profile-tab-content">
                {activeTab === "overview" ? (
                  <div className="profile-section-stack">
                    {profile.profileNotifications.length > 0 ? (
                      <div className="profile-notification-list">
                        {profile.profileNotifications.map((notification) => (
                          <article key={notification.id} className="profile-notification-card glass">
                            <div>
                              <div className="section-label">Уведомление</div>
                              <strong>{notification.title}</strong>
                              {notification.body ? <div className="muted" style={{ marginTop: 6 }}>{notification.body}</div> : null}
                              {notification.product ? (
                                <div className="muted" style={{ marginTop: 6 }}>
                                  {notification.product.name} • {notification.product.price.toLocaleString("ru-RU")} ₽
                                </div>
                              ) : null}
                            </div>
                            <form action={openProfileNotificationAction} className="actions">
                              <input type="hidden" name="notificationId" value={notification.id} />
                              <input type="hidden" name="actionUrl" value={notification.actionUrl ?? "/profile"} />
                              <button className="button button-primary button-sm" type="submit">Открыть товар</button>
                            </form>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="profile-device-empty glass">
                        <strong>Новых уведомлений пока нет.</strong>
                        <p className="muted" style={{ margin: 0 }}>
                          Когда появится подходящий trade-in вариант или важное обновление по профилю, оно появится здесь.
                        </p>
                      </div>
                    )}

                    <div className="glass" style={{ padding: 18, display: "grid", gap: 8 }}>
                      <div className="section-label">Что доступно в профиле</div>
                      <div className="muted">
                        Управляйте своими устройствами, смотрите персональные предложения, ведите список ожидания и проверяйте историю покупок по отдельным вкладкам.
                      </div>
                    </div>

                    {profile.pendingPurchasedDevices.length > 0 ? (
                      <div className="glass" style={{ padding: 18, display: "grid", gap: 14 }}>
                        <div>
                          <div className="section-label">Недавние покупки</div>
                          <h3 style={{ margin: "6px 0 0" }}>Добавьте купленные устройства в профиль</h3>
                        </div>
                        <div className="profile-pending-device-list">
                          {profile.pendingPurchasedDevices.map((device: PendingPurchasedDevice) => (
                            <article key={device.orderItemId} className="profile-pending-device-card">
                              <div className="profile-pending-device-main">
                                <div className="profile-pending-device-media">
                                  {device.imageUrl ? <img src={device.imageUrl} alt={device.model} loading="lazy" /> : <div className="product-media-fallback" />}
                                </div>
                                <div className="profile-pending-device-copy">
                                  <strong>{getPendingDeviceTitle(device)}</strong>
                                  <div className="muted">
                                    Из заказа {formatOrderNumber({ id: device.orderId, orderNumber: device.orderNumber, createdAt: device.orderCreatedAt })}
                                  </div>
                                </div>
                              </div>
                              <form action={addPurchasedProfileDeviceAction}>
                                <input type="hidden" name="orderId" value={device.orderId} />
                                <input type="hidden" name="orderItemId" value={device.orderItemId} />
                                <button className="button button-primary button-sm" type="submit">Добавить в мои устройства</button>
                              </form>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === "devices" ? (
                  <div className="profile-section-stack">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <h2 style={{ marginBottom: 6 }}>Мои устройства</h2>
                        <p className="muted" style={{ margin: 0 }}>
                          Сохраненные устройства помогают быстро пересчитывать trade-in и использовать персональные предложения отдельно.
                        </p>
                      </div>
                      <div className="actions">
                        <Link className="button button-secondary" href="/profile/devices/add">Добавить устройство</Link>
                      </div>
                    </div>

                    {profile.pendingPurchasedDevices.length > 0 ? (
                      <div className="profile-alert-banner glass">
                        <div>
                          <strong>Есть устройства из завершённых заказов, которые можно привязать к профилю.</strong>
                          <div className="muted" style={{ marginTop: 6 }}>
                            Добавьте их в «Мои устройства», чтобы они участвовали в персональных предложениях и апгрейдах.
                          </div>
                        </div>
                        <Link className="button button-primary button-sm" href="/profile">Показать предложения</Link>
                      </div>
                    ) : null}

                    {profile.userDevices.length === 0 ? (
                      <div className="profile-device-empty glass">
                        <strong>У вас пока нет сохраненных устройств.</strong>
                        <p className="muted" style={{ margin: 0 }}>
                          Пройдите оценку в trade-in и включите сохранение в профиль. Устройство появится здесь автоматически.
                        </p>
                      </div>
                    ) : (
                      <div className="profile-device-grid">
                        {profile.userDevices.map((device) => (
                          <article key={device.id} className="profile-device-card glass">
                            <div className="profile-device-card-top">
                              {device.imageUrl ? (
                                <div className="profile-device-media">
                                  <img src={device.imageUrl} alt={getDeviceTitle(device)} loading="lazy" />
                                </div>
                              ) : null}
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", flex: 1 }}>
                                <div>
                                  <div className="section-label">{deviceCategoryLabels[device.categoryCode] ?? device.categoryCode}</div>
                                  <h3 style={{ margin: "6px 0 0" }}>{getDeviceTitle(device)}</h3>
                                </div>
                                <div className="profile-device-price">{device.estimatedTradeInValue.toLocaleString("ru-RU")} ₽</div>
                              </div>
                            </div>

                            <div className="profile-device-meta">
                              <span className="pill pill-muted">{device.model}</span>
                              {device.storage ? <span className="pill pill-muted">{device.storage}</span> : null}
                              <span className="pill pill-muted">{device.condition}</span>
                              {device.lastTradeInSnapshotVersion ? <span className="pill pill-muted">snapshot v{device.lastTradeInSnapshotVersion}</span> : null}
                            </div>

                            <div className="muted">
                              Обновлено {device.updatedAt.toLocaleString("ru-RU")}
                              {device.tradeInRequestId ? ` • из заявки ${device.tradeInRequestId}` : ""}
                            </div>

                            <div className="actions">
                              <Link className="button button-secondary button-sm" href={`/profile/devices/add?deviceId=${device.id}` as never}>Переоценить в профиле</Link>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === "offers" ? (
                  <div className="profile-section-stack">
                    <div className="profile-alert-banner glass">
                      <strong>Персональные предложения доступны внутри сайта.</strong>
                      <span className="muted">Подходящие новые и trade-in варианты показываем прямо в профиле и на главной странице без автоматической подписки на уведомления.</span>
                    </div>

                    {profile.userDevices.length === 0 ? (
                      <div className="profile-device-empty glass">
                        <strong>Пока нет основы для персональных предложений.</strong>
                        <p className="muted" style={{ margin: 0 }}>
                          Сначала добавьте устройство в профиль, чтобы мы могли подобрать релевантные варианты апгрейда.
                        </p>
                      </div>
                    ) : (
                      <div className="profile-device-grid">
                        {profile.userDevices.map((device) => (
                          <article key={device.id} className="profile-device-card glass">
                            <div>
                              <div className="section-label">Для устройства</div>
                              <h3 style={{ margin: "6px 0 0" }}>{getDeviceTitle(device)}</h3>
                            </div>

                            {device.upgradeSuggestions.length > 0 ? (
                              <div className="profile-upgrade-list" style={{ borderTop: "none", paddingTop: 0 }}>
                                <div className="profile-upgrade-grid">
                                  {device.upgradeSuggestions.map((product) => (
                                    <Link
                                      key={product.slug}
                                      href={`/catalog/${product.categorySlug}/${product.slug}`}
                                      className="profile-upgrade-card"
                                    >
                                      <div className="profile-upgrade-card-top">
                                        <div className="profile-upgrade-card-media">
                                          {product.imageUrl ? (
                                            <img src={product.imageUrl} alt={product.name} loading="lazy" />
                                          ) : (
                                            <div className="product-media-fallback" />
                                          )}
                                        </div>
                                        <span className="pill pill-muted">{product.inventoryLabel}</span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                        <strong>{product.name}</strong>
                                      </div>
                                      <div className="muted">С учетом Trade-in от {product.finalPriceAfterTradeIn.toLocaleString("ru-RU")} ₽</div>
                                      <div>
                                        <strong>{product.price.toLocaleString("ru-RU")} ₽</strong>
                                        {product.compareAtPrice ? <span className="muted"> вместо {product.compareAtPrice.toLocaleString("ru-RU")} ₽</span> : null}
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="profile-device-empty glass">
                                <strong>Для этого устройства пока нет готовых вариантов апгрейда.</strong>
                                <p className="muted" style={{ margin: 0 }}>
                                  Вернитесь позже или обновите оценку, когда в каталоге появятся новые предложения.
                                </p>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === "waitlist" ? (
                  <div className="profile-section-stack">
                    <div className="glass" style={{ padding: 18, display: "grid", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div className="section-label">Список ожидания</div>
                          <p className="muted" style={{ margin: "6px 0 0" }}>
                            Явные запросы на trade-in устройства. Они не создаются автоматически из сохраненных устройств.
                          </p>
                        </div>
                        <div className="actions">
                          <Link className="button button-secondary" href="/waitlist/add">Добавить в список ожидания</Link>
                        </div>
                      </div>

                      {profile.usedDeviceWaitlistEntries.length === 0 ? (
                        <div className="profile-device-empty glass">
                          <strong>Список ожидания пока пуст.</strong>
                          <p className="muted" style={{ margin: 0 }}>
                            Добавьте конкретную модель и параметры, если нужного trade-in устройства сейчас нет в каталоге.
                          </p>
                        </div>
                      ) : (
                        <div className="profile-waitlist-grid">
                          {profile.usedDeviceWaitlistEntries.map((entry) => (
                            <article key={entry.id} className="profile-waitlist-card glass">
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                                <div>
                                  <div className="section-label">{deviceCategoryLabels[entry.categoryCode] ?? entry.categoryCode}</div>
                                  <h3 style={{ margin: "6px 0 0" }}>{entry.model}</h3>
                                </div>
                                <span className="pill">{waitlistStatusLabels[entry.status] ?? entry.status}</span>
                              </div>

                              <div className="profile-waitlist-meta">
                                {entry.storage ? <span className="pill pill-muted">{entry.storage}</span> : null}
                                {entry.color ? <span className="pill pill-muted">{entry.color}</span> : <span className="pill pill-muted">Любой цвет</span>}
                                {entry.displaySize ? <span className="pill pill-muted">{entry.displaySize}</span> : null}
                                {entry.connectivity ? <span className="pill pill-muted">{entry.connectivity}</span> : null}
                                {entry.fulfilledByOrderId ? <span className="pill pill-muted">Заказ {entry.fulfilledByOrderId}</span> : null}
                              </div>

                              <div className="muted">
                                Создано {entry.createdAt.toLocaleString("ru-RU")}
                                {entry.updatedAt.getTime() !== entry.createdAt.getTime() ? ` • обновлено ${entry.updatedAt.toLocaleString("ru-RU")}` : ""}
                              </div>

                              <div className="actions">
                                <Link className="button button-secondary button-sm" href="/waitlist/add">Добавить ещё</Link>
                                <form action={deleteUsedDeviceWaitlistEntryAction}>
                                  <input type="hidden" name="entryId" value={entry.id} />
                                  <button className="button button-secondary button-sm" type="submit">Удалить</button>
                                </form>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeTab === "orders" ? (
                  <div className="profile-section-stack">
                    <div>
                      <h2 style={{ marginBottom: 6 }}>История покупок</h2>
                      <p className="muted" style={{ margin: 0 }}>
                        Здесь хранятся ваши оформленные заказы, их статусы и состав покупки.
                      </p>
                    </div>

                    {profile.orders.length === 0 ? (
                      <p className="muted">Пока нет заказов. После первой покупки здесь появится история.</p>
                    ) : (
                      profile.orders.map((order) => (
                        <article key={order.id} className="profile-order-card glass">
                          <div className="profile-order-head">
                            <div>
                              <div className="section-label">Заказ</div>
                              <h3 style={{ margin: "6px 0 0" }}>
                                {formatOrderNumber({ id: order.id, orderNumber: order.orderNumber, createdAt: order.createdAt })}
                              </h3>
                            </div>
                            <div className="profile-order-meta-top">
                              <span className="pill">{statusLabels[order.status] ?? order.status}</span>
                              <span className="muted">{order.createdAt.toLocaleString("ru-RU")}</span>
                            </div>
                          </div>

                          <div className="profile-order-products">
                            {order.items.map((item) => {
                              const productHref = item.slug && item.categorySlug ? `/catalog/${item.categorySlug}/${item.slug}` : null;

                              const content = (
                                <>
                                  <div className="profile-order-product-media">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} loading="lazy" />
                                    ) : (
                                      <div className="product-media-fallback" />
                                    )}
                                  </div>
                                  <div className="profile-order-product-body">
                                    <strong>{item.name}</strong>
                                    {item.variantLabel ? <div className="muted">{item.variantLabel}</div> : null}
                                    <div className="profile-order-product-price-row">
                                      <span>{item.price.toLocaleString("ru-RU")} ₽</span>
                                      <span className="muted">x {item.quantity}</span>
                                    </div>
                                  </div>
                                </>
                              );

                              return (
                                <div key={item.id} className="profile-order-product-card">
                                  {productHref ? (
                                    <Link href={productHref as never} className="profile-order-product-card-link">
                                      {content}
                                    </Link>
                                  ) : (
                                    <div className="profile-order-product-card-link">{content}</div>
                                  )}
                                  {order.status === "completed" && item.canAddToDevices ? (
                                    <form action={addPurchasedProfileDeviceAction} className="profile-order-item-action">
                                      <input type="hidden" name="orderId" value={order.id} />
                                      <input type="hidden" name="orderItemId" value={item.id} />
                                      <button className="button button-secondary button-sm" type="submit">Добавить в мои устройства</button>
                                    </form>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                          <div className="profile-order-breakdown glass">
                            <div className="section-label">Состав заказа</div>
                            <div className="profile-order-line-list">
                              {order.items.map((item) => (
                                <div key={item.id} className="profile-order-line">
                                  <span>
                                    {item.name}
                                    {item.variantLabel ? ` (${item.variantLabel})` : ""}
                                    {` x ${item.quantity}`}
                                  </span>
                                  <strong>{(item.price * item.quantity).toLocaleString("ru-RU")} ₽</strong>
                                </div>
                              ))}
                            </div>
                            <div className="profile-order-summary">
                              <div className="profile-order-summary-row">
                                <span>Общая сумма</span>
                                <strong>{order.total.toLocaleString("ru-RU")} ₽</strong>
                              </div>
                              <div className="profile-order-summary-row">
                                <span>Начислено баллов</span>
                                <strong>{order.cashbackPointsAwarded.toLocaleString("ru-RU")}</strong>
                              </div>
                              <div className="profile-order-summary-row">
                                <span>Промокод</span>
                                <strong>
                                  {order.promoCode
                                    ? `${order.promoCode}${order.promoRewardDescription ? ` • ${order.promoRewardDescription}` : ""}`
                                    : "Не применялся"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}