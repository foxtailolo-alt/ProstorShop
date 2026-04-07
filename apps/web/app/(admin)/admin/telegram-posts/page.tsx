import { prisma } from "@prostor/db";
import { publishTelegramPostAction } from "./actions";

export default async function AdminTelegramPostsPage() {
  const [products, posts] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, price: true, imageUrl: true },
    }),
    prisma.telegramPost.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
      take: 20,
    }),
  ]);

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Telegram посты</div>
        <h1>Публикация товара в группу с CTA на Mini App.</h1>
        <p>
          Это закрывает контентный цикл: товар в каталоге, пост в группе, переход на конкретный
          товар в Mini App с сохранением источника.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Создать пост</div>
        <form action={publishTelegramPostAction} className="form-grid">
          <label className="field field-wide">
            <span>Товар</span>
            <select name="productSlug" defaultValue={products[0]?.slug}>
              {products.map((product) => (
                <option key={product.id} value={product.slug}>
                  {product.name} • {Number(product.price).toLocaleString("ru-RU")} ₽{product.imageUrl ? " • с фото" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-wide">
            <span>Заголовок</span>
            <input name="title" type="text" placeholder="Новый iPhone уже в Просторе" required />
          </label>
          <label className="field field-wide">
            <span>Описание</span>
            <textarea
              name="description"
              rows={5}
              placeholder="Коротко и по делу: что это за товар, почему он интересен и почему стоит открыть Mini App."
              required
            />
          </label>
          <label className="field">
            <span>Текст кнопки</span>
            <input name="ctaText" type="text" defaultValue="Открыть в Mini App" />
          </label>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">
              Опубликовать в Telegram
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">История публикаций</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Товар</div>
            <div>Заголовок</div>
            <div>Статус</div>
            <div>Дата</div>
            <div>Ссылка</div>
          </div>
          {posts.map((post) => (
            <div key={post.id} className="admin-table-row">
              <div>{post.product.name}</div>
              <div>{post.title}</div>
              <div>{post.status}</div>
              <div>{post.createdAt.toLocaleString("ru-RU")}</div>
              <div>
                <a className="button button-secondary" href={post.deepLink} target="_blank" rel="noreferrer">
                  Открыть ссылку
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}