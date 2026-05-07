import { prisma } from "@prostor/db";
import {
  applyTelegramProductDiscountAction,
  clearTelegramProductDiscountAction,
  publishTelegramPostAction,
} from "./actions";
import { TelegramPostForm } from "../../../../components/admin/telegram-post-preview";
import { buildPriceText, formatProductPrice, resolveProductPrice } from "../../../../lib/pricing";
import { buildTelegramPostPreviewHtml } from "../../../../lib/telegram-post-template";

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
      include: {
        product: {
          include: {
            category: {
              select: { slug: true, name: true },
            },
          },
        },
      },
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

  const historyPosts = posts.map((post) => {
    const discountType = post.product.discountType === "percent" || post.product.discountType === "fixed"
      ? post.product.discountType
      : undefined;
    const resolvedPrice = resolveProductPrice({
      basePrice: Number(post.product.price),
      discountType,
      discountValue: post.product.discountValue ? Number(post.product.discountValue) : null,
      discountStartsAt: post.product.discountStartsAt,
      discountEndsAt: post.product.discountEndsAt,
    });
    const priceText = buildPriceText(resolvedPrice.price, resolvedPrice.compareAtPrice);

    return {
      ...post,
      previewHtml: buildTelegramPostPreviewHtml({
        title: post.title,
        description: post.description,
        priceText,
      }),
      currentPriceLabel: resolvedPrice.compareAtPrice
        ? `${formatProductPrice(resolvedPrice.compareAtPrice)} -> ${formatProductPrice(resolvedPrice.price)}`
        : formatProductPrice(resolvedPrice.price),
      buttonText: "Открыть в Mini App",
    };
  });

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
        <div className="telegram-history-list">
          {historyPosts.map((post) => (
            <article key={post.id} className="telegram-history-card">
              <div className="telegram-history-meta">
                <div className="telegram-history-meta-grid">
                  <div>
                    <div className="section-label">Товар</div>
                    <div className="telegram-history-meta-value">{post.product.name}</div>
                  </div>
                  <div>
                    <div className="section-label">Статус</div>
                    <div className="telegram-history-status">{post.status}</div>
                  </div>
                  <div>
                    <div className="section-label">Дата</div>
                    <div className="telegram-history-meta-value">{post.createdAt.toLocaleString("ru-RU")}</div>
                  </div>
                  <div>
                    <div className="section-label">Цена</div>
                    <div className="telegram-history-meta-value">{post.currentPriceLabel}</div>
                  </div>
                </div>

                <div className="telegram-history-actions">
                  <a className="button button-secondary" href={post.deepLink} target="_blank" rel="noreferrer">
                    Открыть ссылку
                  </a>
                </div>
              </div>

              <div className="telegram-history-preview">
                {post.product.imageUrl ? (
                  <div className="telegram-history-preview-image-wrap">
                    <img
                      src={post.product.imageUrl}
                      alt={post.product.name}
                      className="telegram-history-preview-image"
                    />
                  </div>
                ) : null}

                <div
                  className="telegram-history-preview-body"
                  dangerouslySetInnerHTML={{ __html: post.previewHtml }}
                />

                <div className="telegram-history-preview-footer">
                  <a
                    className="button button-primary button-sm telegram-history-preview-button"
                    href={post.deepLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {post.buttonText}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}