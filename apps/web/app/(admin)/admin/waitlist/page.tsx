import Link from "next/link";
import { prisma } from "@prostor/db";
import { AdminPagination, AdminSearch, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { updateUsedDeviceWaitlistStatusAction } from "./actions";

const waitlistStatusLabels: Record<string, string> = {
  active: "Активно",
  matched: "Найден вариант",
  fulfilled: "Исполнено",
  cancelled: "Отменено",
};

type AdminWaitlistPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function AdminWaitlistPage({ searchParams }: AdminWaitlistPageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const currentPage = Math.max(1, Number(params.page) || 1);

  const searchWhere = searchQuery
    ? {
        OR: [
          { model: { contains: searchQuery, mode: "insensitive" as const } },
          { brand: { contains: searchQuery, mode: "insensitive" as const } },
          { user: { firstName: { contains: searchQuery, mode: "insensitive" as const } } },
          { user: { lastName: { contains: searchQuery, mode: "insensitive" as const } } },
          { user: { telegramUsername: { contains: searchQuery, mode: "insensitive" as const } } },
          { user: { phone: { contains: searchQuery, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [totalCount, entries] = await Promise.all([
    prisma.usedDeviceWaitlistEntry.count({ where: searchWhere }),
    prisma.usedDeviceWaitlistEntry.findMany({
      where: searchWhere,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            telegramUsername: true,
            phone: true,
          },
        },
        matches: {
          orderBy: [{ notifiedAt: "desc" }, { createdAt: "desc" }],
          take: 3,
          include: {
            product: {
              include: {
                category: {
                  select: { slug: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Waitlist</div>
        <h1>Явные ожидания на trade-in устройства.</h1>
        <p>Очередь показывает, кто и что ждёт, какие совпадения уже найдены и было ли уведомление в Telegram.</p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Список ожидания ({totalCount})</div>
        <AdminSearch basePath="/admin/waitlist" query={searchQuery} placeholder="Поиск по пользователю, телефону, бренду или модели..." />
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Клиент</div>
            <div>Запрос</div>
            <div>Совпадения</div>
            <div>Статус</div>
          </div>
          {entries.map((entry) => {
            const customerName = [entry.user.firstName, entry.user.lastName].filter(Boolean).join(" ") || entry.user.telegramUsername || "Пользователь";

            return (
              <div key={entry.id} className="admin-table-row">
                <div>
                  <strong>{customerName}</strong>
                  {entry.user.phone ? <div className="muted">{entry.user.phone}</div> : null}
                  {entry.user.telegramUsername ? <div className="muted">@{entry.user.telegramUsername}</div> : null}
                  <div className="muted">{entry.createdAt.toLocaleString("ru-RU")}</div>
                </div>
                <div>
                  <strong>{entry.model}</strong>
                  <div className="muted">{entry.brand} • {entry.categoryCode}</div>
                  <div className="profile-waitlist-meta">
                    {entry.storage ? <span className="pill pill-muted">{entry.storage}</span> : null}
                    {entry.color ? <span className="pill pill-muted">{entry.color}</span> : <span className="pill pill-muted">Любой цвет</span>}
                    {entry.displaySize ? <span className="pill pill-muted">{entry.displaySize}</span> : null}
                    {entry.connectivity ? <span className="pill pill-muted">{entry.connectivity}</span> : null}
                  </div>
                  {entry.fulfilledByOrderId ? <div className="muted">Исполнено заказом {entry.fulfilledByOrderId}</div> : null}
                </div>
                <div>
                  {entry.matches.length === 0 ? (
                    <span className="muted">Совпадений пока нет</span>
                  ) : (
                    <div className="admin-waitlist-match-list">
                      {entry.matches.map((match) => (
                        <div key={match.id} className="admin-waitlist-match-item">
                          <Link href={`/catalog/${match.product.category.slug}/${match.product.slug}`}>
                            {match.product.name}
                          </Link>
                          <div className="muted">
                            confidence {match.confidence} • {match.matchSource}
                            {match.notifiedAt ? ` • Telegram ${match.notifiedAt.toLocaleString("ru-RU")}` : " • Telegram не отправлен"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <form action={updateUsedDeviceWaitlistStatusAction} className="form-grid">
                    <input type="hidden" name="entryId" value={entry.id} />
                    <label className="field field-wide">
                      <span>Статус</span>
                      <select name="status" defaultValue={entry.status}>
                        {Object.entries(waitlistStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="actions field-wide">
                      <button className="button button-secondary button-sm" type="submit">Сохранить</button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
        <AdminPagination basePath="/admin/waitlist" currentPage={currentPage} totalPages={totalPages} searchQuery={searchQuery} />
      </section>
    </main>
  );
}