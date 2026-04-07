import { prisma } from "@prostor/db";
import {
  deleteAttributeAction,
  deleteCategoryAction,
  upsertAttributeAction,
  upsertCategoryAction,
} from "./actions";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      attributes: {
        orderBy: { label: "asc" },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Категории и фильтры</div>
        <h1>Редактирование структуры каталога без ручных правок в коде.</h1>
        <p>
          Здесь задаются категории и фильтры, которые потом сразу читаются витриной. Это критично
          для гибкой настройки ассортимента и рекламных сценариев.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Добавить категорию</div>
        <form action={upsertCategoryAction} className="form-grid">
          <label className="field">
            <span>Название</span>
            <input name="name" type="text" placeholder="Apple Watch" required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" type="text" placeholder="apple-watch" />
          </label>
          <label className="field field-wide">
            <span>SEO title</span>
            <input name="seoTitle" type="text" placeholder="Купить Apple Watch в Просторе" />
          </label>
          <label className="field field-wide">
            <span>SEO description</span>
            <textarea name="seoDescription" rows={3} placeholder="Описание для сниппета категории и рекламы." />
          </label>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">
              Сохранить категорию
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="grid">
        {categories.map((category) => (
          <article key={category.id} className="card glass admin-category-card">
            <div className="admin-category-header">
              <div>
                <div className="section-label">Категория</div>
                <h2>{category.name}</h2>
                <p className="muted">
                  Slug: {category.slug} • Товаров: {category._count.products}
                </p>
                {category.seoTitle ? <p className="muted">SEO настроен</p> : null}
              </div>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="categoryId" value={category.id} />
                <button className="button button-secondary" type="submit">
                  Удалить категорию
                </button>
              </form>
            </div>

            <form action={upsertCategoryAction} className="form-grid">
              <input type="hidden" name="categoryId" value={category.id} />
              <label className="field">
                <span>Название</span>
                <input name="name" type="text" defaultValue={category.name} required />
              </label>
              <label className="field">
                <span>Slug</span>
                <input name="slug" type="text" defaultValue={category.slug} required />
              </label>
              <label className="field field-wide">
                <span>SEO title</span>
                <input name="seoTitle" type="text" defaultValue={category.seoTitle ?? ""} />
              </label>
              <label className="field field-wide">
                <span>SEO description</span>
                <textarea name="seoDescription" rows={3} defaultValue={category.seoDescription ?? ""} />
              </label>
              <div className="actions field-wide">
                <button className="button button-secondary" type="submit">
                  Обновить категорию
                </button>
              </div>
            </form>

            <div className="section-label" style={{ marginTop: 18 }}>Фильтры категории</div>
            <div className="admin-table">
              <div className="admin-table-row admin-table-head">
                <div>Label</div>
                <div>Code</div>
                <div>Тип</div>
                <div>Значения</div>
                <div>Действия</div>
              </div>
              {category.attributes.map((attribute) => (
                <div key={attribute.id} className="admin-table-row">
                  <div>{attribute.label}</div>
                  <div>{attribute.code}</div>
                  <div>{attribute.type}</div>
                  <div>{attribute.values.join(", ")}</div>
                  <div className="actions">
                    <form action={deleteAttributeAction}>
                      <input type="hidden" name="attributeId" value={attribute.id} />
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button className="button button-secondary" type="submit">
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <form action={upsertAttributeAction} className="form-grid" style={{ marginTop: 18 }}>
              <input type="hidden" name="categoryId" value={category.id} />
              <label className="field">
                <span>Code</span>
                <input name="code" type="text" placeholder="storage" required />
              </label>
              <label className="field">
                <span>Label</span>
                <input name="label" type="text" placeholder="Память" required />
              </label>
              <label className="field">
                <span>Тип</span>
                <select name="type" defaultValue="single-select">
                  <option value="single-select">single-select</option>
                  <option value="multi-select">multi-select</option>
                </select>
              </label>
              <label className="field field-wide">
                <span>Значения через запятую</span>
                <input name="values" type="text" placeholder="128 ГБ, 256 ГБ, 512 ГБ" required />
              </label>
              <label className="field field-checkbox">
                <input name="isFilterable" type="checkbox" defaultChecked />
                <span>Показывать как фильтр на витрине</span>
              </label>
              <div className="actions field-wide">
                <button className="button button-primary" type="submit">
                  Сохранить фильтр
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}