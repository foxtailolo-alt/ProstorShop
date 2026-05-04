import { prisma } from "@prostor/db";
import {
  applyTelegramProductDiscountAction,
  clearTelegramProductDiscountAction,
  publishTelegramPostAction,
} from "./actions";
import { TelegramPostForm } from "../../../../components/admin/telegram-post-preview";
import { resolveProductPrice } from "../../../../lib/pricing";

type TelegramPostFormProduct = {
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  imageUrl: string | null;
  description: string | null;
  categorySlug: string;
  categoryName: string;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  discountEndsAt?: string;
};

export default async function AdminTelegramPostsPage() {
  const [products, posts] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        imageUrl: true,
        description: true,
        discountType: true,
        discountValue: true,
        discountStartsAt: true,
        discountEndsAt: true,
        category: {
          select: { slug: true, name: true },
        },
      },
    }),
    prisma.telegramPost.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
      take: 20,
    }),
  ]);

  const productList: TelegramPostFormProduct[] = products.map((p) => ({
    ...(() => {
      const discountType = p.discountType === "percent" || p.discountType === "fixed"
        ? p.discountType
        : undefined;
      const resolvedPrice = resolveProductPrice({
        basePrice: Number(p.price),
        discountType,
        discountValue: p.discountValue ? Number(p.discountValue) : null,
        discountStartsAt: p.discountStartsAt,
        discountEndsAt: p.discountEndsAt,
      });

      return {
        slug: p.slug,
        name: p.name,
        price: resolvedPrice.price,
        compareAtPrice: resolvedPrice.compareAtPrice,
        imageUrl: p.imageUrl,
        description: p.description,
        categorySlug: p.category.slug,
        categoryName: p.category.name,
        discountType,
        discountValue: p.discountValue ? Number(p.discountValue) : undefined,
        discountEndsAt: p.discountEndsAt ? new Date(p.discountEndsAt).toISOString() : undefined,
      };
    })(),
  }));

  const categoryOptions = Array.from(
    new Map(productList.map((product) => [product.categorySlug, product.categoryName])).entries(),
  )
    .map(([slug, name]) => ({ slug, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "ru-RU"));

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

      <TelegramPostForm
        products={productList}
        categories={categoryOptions}
        publishAction={publishTelegramPostAction}
        applyDiscountAction={applyTelegramProductDiscountAction}
        clearDiscountAction={clearTelegramProductDiscountAction}
      />

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