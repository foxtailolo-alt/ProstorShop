import { prisma } from "@prostor/db";
import { updateOrderStatusAction } from "./actions";

const orderStatuses = [
  { value: "pending", label: "Новая" },
  { value: "contacted", label: "Связались" },
  { value: "confirmed", label: "Подтверждена" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
] as const;

type AttributionValue = {
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  yclid?: string;
  landingPath?: string;
};

function parseAttribution(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as AttributionValue;
}

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      user: true,
    },
    take: 50,
  });

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Заказы</div>
        <h1>Оператор видит заявки, товар и источник обращения в одном месте.</h1>
        <p>
          Это первый рабочий checkout-слой без онлайн-оплаты: клиент отправляет заявку, а админка
          сохраняет контекст для дальнейшей продажи.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Последние заявки</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Клиент</div>
            <div>Товар</div>
            <div>Сумма</div>
            <div>Статус</div>
            <div>Источник</div>
          </div>
          {orders.map((order) => {
            const attribution = parseAttribution(order.attribution);

            return (
              <div key={order.id} className="admin-table-row">
                <div>
                  <strong>{order.customerName}</strong>
                  <div className="muted">{order.phone}</div>
                  <div className="muted">{order.createdAt.toLocaleString("ru-RU")}</div>
                </div>
                <div>
                  {order.items.length > 0 ? (
                    <>
                      {order.items.map((item) => (
                        <div key={item.id} className="muted">
                          {item.product.name} x {item.quantity}
                        </div>
                      ))}
                      {order.note ? <div className="muted">{order.note}</div> : null}
                    </>
                  ) : (
                    <span className="muted">Без позиции</span>
                  )}
                </div>
                <div>{Number(order.total).toLocaleString("ru-RU")} ₽</div>
                <div>
                  <form action={updateOrderStatusAction} className="form-grid">
                    <input type="hidden" name="orderId" value={order.id} />
                    <label className="field field-wide">
                      <span>Статус</span>
                      <select name="status" defaultValue={order.status}>
                        {orderStatuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="actions field-wide">
                      <button className="button button-secondary" type="submit">
                        Сохранить
                      </button>
                    </div>
                  </form>
                </div>
                <div>
                  {attribution?.source ? <div className="muted">Source: {attribution.source}</div> : null}
                  {attribution?.utmSource ? <div className="muted">UTM: {attribution.utmSource}</div> : null}
                  {attribution?.utmCampaign ? <div className="muted">Campaign: {attribution.utmCampaign}</div> : null}
                  {attribution?.yclid ? <div className="muted">YCLID: {attribution.yclid}</div> : null}
                  {attribution?.landingPath ? <div className="muted">Landing: {attribution.landingPath}</div> : null}
                  {!attribution ? <span className="muted">Нет данных</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}