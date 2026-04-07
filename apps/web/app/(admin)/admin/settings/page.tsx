import { getFeatureFlagEntries } from "../../../../lib/data/catalog";
import { updateFeatureFlagAction } from "./actions";

export default async function AdminSettingsPage() {
  const featureFlags = await getFeatureFlagEntries();

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Настройки</div>
        <h1>Гибкое включение и отключение ключевых сценариев.</h1>
        <p>
          Feature flags позволяют выключать отдельные блоки без правок в нескольких местах. Это
          поддерживает гибкость проекта без избыточной архитектуры.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-2">
        {featureFlags.map((flag) => (
          <form key={flag.key} action={updateFeatureFlagAction} className="card glass admin-flag-card">
            <input type="hidden" name="key" value={flag.key} />
            <div className="section-label">Feature flag</div>
            <h2>{flag.key}</h2>
            <label className="field field-checkbox">
              <input name="enabled" type="checkbox" defaultChecked={flag.enabled} />
              <span>{flag.enabled ? "Включено" : "Выключено"}</span>
            </label>
            <div className="actions">
              <button className="button button-primary" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        ))}
      </section>
    </main>
  );
}