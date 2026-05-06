import { prisma } from "@prostor/db";
import { requirePermission } from "../../../../lib/auth/session";
import {
  deletePromoCodeAction,
  togglePromoCodeAction,
  upsertPromoCodeAction,
} from "./actions";

const SCOPE_LABELS: Record<string, string> = {
  cart: "Корзина",
  "trade-in": "Trade-in",
  any: "Везде",
};

const DISCOUNT_LABELS: Record<string, string> = {
  reward: "Подарок / описание",
  flat: "Сумма",
  percent: "Процент",
};

const TYPE_LABELS: Record<string, string> = {
  custom: "Ручной",
  referral: "Реферальный",
  "trade-in-bonus": "Trade-in бонус",
};

function formatDateInputValue(date: Date | null) {
  if (!date) return "";
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return iso.slice(0, 16);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function formatDiscount(record: {
  discountKind: string;
  discountValue: { toString(): string } | null;
  rewardDescription: string | null;
}) {
  if (record.discountKind === "flat" && record.discountValue) {
    return `${Number(record.discountValue).toLocaleString("ru-RU")} ₽`;
  }
  if (record.discountKind === "percent" && record.discountValue) {
    return `${Number(record.discountValue).toLocaleString("ru-RU")} %`;
  }
  return record.rewardDescription ?? "Подарок";
}

type AdminPromoCodesPageProps = {
  searchParams?: Promise<{ q?: string; scope?: string; status?: string }>;
};

export default async function AdminPromoCodesPage({ searchParams }: AdminPromoCodesPageProps) {
  await requirePermission("promo-codes", "read");

  const resolved = (await searchParams) ?? {};
  const search = resolved.q?.trim() ?? "";
  const scope = resolved.scope?.trim() ?? "";
  const status = resolved.status?.trim() ?? "";

  const where = {
    AND: [
      search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { rewardDescription: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {},
      scope && SCOPE_LABELS[scope] ? { scope } : {},
      status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {},
    ],
  };

  const promoCodes = await prisma.promoCode.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      ownerUser: {
        select: { firstName: true, lastName: true, telegramUsername: true, phone: true },
      },
      _count: {
        select: { orders: true, tradeInRedemptions: true },
      },
    },
  });

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Промокоды и скидки</div>
        <h1>Управление промокодами</h1>
        <p>
          Создавайте кампании для корзины и Trade-in оценки, ограничивайте по периоду и числу использований,
          активируйте или отключайте мгновенно.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Создать промокод</div>
        <form action={upsertPromoCodeAction} className="form-grid promo-form">
          <label className="field">
            <span>Код</span>
            <input name="code" placeholder="Оставьте пустым для авто-генерации" />
          </label>
          <label className="field" style={{ alignSelf: "end" }}>
            <input type="checkbox" name="autoCode" defaultChecked /> Сгенерировать автоматически
          </label>
          <label className="field">
            <span>Где работает</span>
            <select name="scope" defaultValue="cart">
              {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Тип скидки</span>
            <select name="discountKind" defaultValue="flat">
              {Object.entries(DISCOUNT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Размер</span>
            <input name="discountValue" inputMode="decimal" placeholder="500 или 10" />
          </label>
          <label className="field field-wide">
            <span>Описание (для подарков)</span>
            <input name="rewardDescription" placeholder="Стекло + чехол в подарок" />
          </label>
          <label className="field">
            <span>Лимит общий</span>
            <input name="usageLimit" inputMode="numeric" placeholder="без лимита" />
          </label>
          <label className="field">
            <span>Лимит на пользователя</span>
            <input name="perUserLimit" inputMode="numeric" placeholder="без лимита" />
          </label>
          <label className="field">
            <span>Действует с</span>
            <input name="startsAt" type="datetime-local" />
          </label>
          <label className="field">
            <span>Действует по</span>
            <input name="endsAt" type="datetime-local" />
          </label>
          <label className="field" style={{ alignSelf: "end" }}>
            <input type="checkbox" name="isActive" defaultChecked /> Активен
          </label>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">Создать промокод</button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Все промокоды ({promoCodes.length})</div>
        <form className="admin-filter-row" method="get">
          <input name="q" placeholder="Код или описание" defaultValue={search} />
          <select name="scope" defaultValue={scope}>
            <option value="">Все области</option>
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="status" defaultValue={status}>
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключённые</option>
          </select>
          <button className="button button-secondary button-sm" type="submit">Применить</button>
        </form>

        <div className="admin-table promo-table">
          <div className="admin-table-row admin-table-head">
            <div>Код</div>
            <div>Скидка</div>
            <div>Условия</div>
            <div>Использования</div>
            <div>Действия</div>
          </div>
          {promoCodes.map((promo) => (
            <details key={promo.id} className="promo-row">
              <summary>
                <div className="admin-table-row">
                  <div>
                    <strong style={{ letterSpacing: 1 }}>{promo.code}</strong>
                    <div className="muted">{TYPE_LABELS[promo.type] ?? promo.type} • {SCOPE_LABELS[promo.scope] ?? promo.scope}</div>
                    {promo.ownerUser ? (
                      <div className="muted">
                        Владелец: {[promo.ownerUser.firstName, promo.ownerUser.lastName].filter(Boolean).join(" ") || promo.ownerUser.telegramUsername || promo.ownerUser.phone}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <strong>{formatDiscount(promo)}</strong>
                    {promo.rewardDescription && promo.discountKind !== "reward" ? (
                      <div className="muted">{promo.rewardDescription}</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="muted">с {formatDate(promo.startsAt)}</div>
                    <div className="muted">по {formatDate(promo.endsAt)}</div>
                    {promo.usageLimit ? <div className="muted">Лимит: {promo.usageLimit}</div> : null}
                    {promo.perUserLimit ? <div className="muted">На пользователя: {promo.perUserLimit}</div> : null}
                  </div>
                  <div>
                    <strong>{promo.usageCount}</strong>
                    <div className="muted">заказов: {promo._count.orders} • trade-in: {promo._count.tradeInRedemptions}</div>
                  </div>
                  <div className="actions">
                    <span className={`pill ${promo.isActive ? "pill-success" : "pill-muted"}`}>
                      {promo.isActive ? "Активен" : "Отключён"}
                    </span>
                  </div>
                </div>
              </summary>

              <div className="promo-row-body">
                <form action={upsertPromoCodeAction} className="form-grid promo-form">
                  <input type="hidden" name="id" value={promo.id} />
                  <label className="field">
                    <span>Код</span>
                    <input name="code" defaultValue={promo.code} required />
                  </label>
                  <label className="field">
                    <span>Где работает</span>
                    <select name="scope" defaultValue={promo.scope}>
                      {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Тип скидки</span>
                    <select name="discountKind" defaultValue={promo.discountKind}>
                      {Object.entries(DISCOUNT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Размер</span>
                    <input name="discountValue" defaultValue={promo.discountValue ? Number(promo.discountValue).toString() : ""} />
                  </label>
                  <label className="field field-wide">
                    <span>Описание</span>
                    <input name="rewardDescription" defaultValue={promo.rewardDescription ?? ""} />
                  </label>
                  <label className="field">
                    <span>Лимит общий</span>
                    <input name="usageLimit" defaultValue={promo.usageLimit ?? ""} />
                  </label>
                  <label className="field">
                    <span>Лимит на пользователя</span>
                    <input name="perUserLimit" defaultValue={promo.perUserLimit ?? ""} />
                  </label>
                  <label className="field">
                    <span>Действует с</span>
                    <input name="startsAt" type="datetime-local" defaultValue={formatDateInputValue(promo.startsAt)} />
                  </label>
                  <label className="field">
                    <span>Действует по</span>
                    <input name="endsAt" type="datetime-local" defaultValue={formatDateInputValue(promo.endsAt)} />
                  </label>
                  <label className="field" style={{ alignSelf: "end" }}>
                    <input type="checkbox" name="isActive" defaultChecked={promo.isActive} /> Активен
                  </label>
                  <div className="actions field-wide" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="button button-primary button-sm" type="submit">Сохранить</button>
                  </div>
                </form>

                <div className="actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <form action={togglePromoCodeAction}>
                    <input type="hidden" name="id" value={promo.id} />
                    <button className="button button-secondary button-sm" type="submit">
                      {promo.isActive ? "Отключить" : "Активировать"}
                    </button>
                  </form>
                  {promo.type === "custom" ? (
                    <form action={deletePromoCodeAction}>
                      <input type="hidden" name="id" value={promo.id} />
                      <button className="button button-secondary button-sm" type="submit">Удалить</button>
                    </form>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
