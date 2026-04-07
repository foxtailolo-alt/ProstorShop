type DevLoginCardProps = {
  redirectTo: string;
  adminIds: string[];
};

export function DevLoginCard({ redirectTo, adminIds }: DevLoginCardProps) {
  if (adminIds.length === 0) {
    return null;
  }

  return (
    <div className="card glass auth-card dev-login-card">
      <div className="section-label">Локальный вход</div>
      <p>
        Telegram widget не работает на localhost без домена, привязанного в BotFather. Для
        локальной разработки можно войти напрямую под одним из настроенных администраторов.
      </p>
      <div className="actions">
        {adminIds.map((telegramId, index) => (
          <form key={telegramId} method="post" action="/api/auth/dev-login">
            <input type="hidden" name="telegramId" value={telegramId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" className={index === 0 ? "button-primary" : "button-secondary"}>
              {index === 0 ? "Войти как главный админ" : `Войти как админ ${index + 1}`}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}