import { prisma } from "@prostor/db";
import { publishTelegramPostAction } from "./actions";
import { TelegramPostForm } from "../../../../components/admin/telegram-post-preview";

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

  const productList = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: Number(p.price),
    imageUrl: p.imageUrl,
  }));

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

      <TelegramPostForm products={productList} publishAction={publishTelegramPostAction} />

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