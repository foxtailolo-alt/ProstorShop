import Link from "next/link";
import { prisma } from "@prostor/db";
import { getAuditMetadataEntries } from "../../../../lib/audit";

type AdminActivityPageProps = {
  searchParams?: Promise<{
    entity?: string;
    action?: string;
  }>;
};

export default async function AdminActivityPage({ searchParams }: AdminActivityPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const entityFilter = params?.entity?.trim();
  const actionFilter = params?.action?.trim();
  const where = {
    ...(entityFilter ? { entityType: entityFilter } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
  };

  const [logs, recentLogs] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
      },
      take: 100,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        entityType: true,
        action: true,
      },
      take: 300,
    }),
  ]);

  const entityCounts = Array.from(
    recentLogs.reduce((accumulator, log) => {
      accumulator.set(log.entityType, (accumulator.get(log.entityType) ?? 0) + 1);
      return accumulator;
    }, new Map<string, number>()),
  ).sort(([left], [right]) => left.localeCompare(right, "ru"));

  const actionCounts = Array.from(
    recentLogs.reduce((accumulator, log) => {
      accumulator.set(log.action, (accumulator.get(log.action) ?? 0) + 1);
      return accumulator;
    }, new Map<string, number>()),
  ).sort(([left], [right]) => left.localeCompare(right, "ru"));

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Журнал действий</div>
        <h1>Ключевые изменения в каталоге и лидах фиксируются для команды.</h1>
        <p>
          Это базовый audit trail для multi-user админки: кто менял статус, товар или правила,
          когда и в каком контексте.
        </p>
        <div className="actions">
          <Link className={`button ${!entityFilter && !actionFilter ? "button-primary" : "button-secondary"}`} href="/admin/activity">
            Все события
          </Link>
          {entityFilter ? (
            <div className="pill">Entity: {entityFilter}</div>
          ) : null}
          {actionFilter ? (
            <div className="pill">Action: {actionFilter}</div>
          ) : null}
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-2">
        <article className="card glass">
          <div className="section-label">Фильтр по сущности</div>
          <div className="actions">
            {entityCounts.map(([entityType, count]) => (
              <Link
                key={entityType}
                className={`button ${entityFilter === entityType ? "button-primary" : "button-secondary"}`}
                href={`/admin/activity?entity=${encodeURIComponent(entityType)}`}
              >
                {entityType} ({count})
              </Link>
            ))}
          </div>
        </article>
        <article className="card glass">
          <div className="section-label">Фильтр по действию</div>
          <div className="actions">
            {actionCounts.slice(0, 16).map(([action, count]) => (
              <Link
                key={action}
                className={`button ${actionFilter === action ? "button-primary" : "button-secondary"}`}
                href={`/admin/activity?action=${encodeURIComponent(action)}`}
              >
                {action} ({count})
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Последние действия</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Когда</div>
            <div>Пользователь</div>
            <div>Действие</div>
            <div>Сущность</div>
            <div>Описание</div>
          </div>
          {logs.map((log) => (
            <div key={log.id} className="admin-table-row">
              <div>{log.createdAt.toLocaleString("ru-RU")}</div>
              <div>
                {log.user
                  ? log.user.firstName ?? log.user.telegramUsername ?? log.user.telegramId ?? log.user.id
                  : "System"}
              </div>
              <div>{log.action}</div>
              <div>
                <strong>{log.entityType}</strong>
                {log.entityId ? <div className="muted">{log.entityId}</div> : null}
              </div>
              <div className="grid">
                <div>{log.summary}</div>
                {getAuditMetadataEntries(log.metadata).length > 0 ? (
                  <div className="actions">
                    {getAuditMetadataEntries(log.metadata).map((entry) => (
                      <div key={`${log.id}-${entry.key}`} className="pill pill-compact">
                        {entry.key}: {entry.value}
                      </div>
                    ))}
                  </div>
                ) : null}
                {log.entityType === "product" && log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) && "sku" in log.metadata && typeof log.metadata.sku === "string" ? (
                  <Link className="button button-secondary" href="/admin/products">
                    Открыть товары
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}