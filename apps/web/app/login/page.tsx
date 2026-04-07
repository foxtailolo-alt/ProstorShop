import { redirect } from "next/navigation";
import { DevLoginCard } from "../../components/auth/dev-login-card";
import { TelegramLoginWidget } from "../../components/auth/telegram-login-widget";
import { getSession, isAdminSession } from "../../lib/auth/session";
import { getAttributionEntries, getAttributionSnapshot } from "../../lib/attribution";

function getLocalAdminIds() {
  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, attribution] = await Promise.all([getSession(), getAttributionSnapshot()]);
  const params = await searchParams;
  const target = params.redirect?.startsWith("/") ? params.redirect : "/admin";
  const attributionEntries = getAttributionEntries(attribution);
  const localAdminIds = getLocalAdminIds();

  if (isAdminSession(session)) {
    redirect(target as "/admin");
  }

  return (
    <main className="page shell">
      <section className="hero glass">
        <div className="section-label">Авторизация</div>
        <h1>Вход в Простор через Telegram.</h1>
        <p>
          Один вход для клиента, Mini App и админки. На этом этапе права администратора выдаются
          тем Telegram ID, которые перечислены в `TELEGRAM_ADMIN_IDS`.
        </p>
        {attributionEntries.length > 0 ? (
          <div className="actions">
            {attributionEntries.map((entry) => (
              <div key={entry.label} className="pill">
                {entry.label}: {entry.value}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div style={{ marginTop: 18 }}>
        <TelegramLoginWidget />
      </div>

      <div style={{ marginTop: 18 }}>
        <DevLoginCard redirectTo={target} adminIds={localAdminIds} />
      </div>
    </main>
  );
}