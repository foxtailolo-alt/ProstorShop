import { Telegraf } from "telegraf";
import { prisma } from "@prostor/db";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot bootstrap is skipped.");
  process.exit(0);
}

const bot = new Telegraf(token);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

bot.start((context) => {
  context.reply("Простор: открой магазин или Mini App", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть магазин", url: siteUrl }],
        [{ text: "Открыть Mini App", web_app: { url: `${siteUrl}/mini-app` } }],
      ],
    },
  });
});

bot.help((context) => {
  context.reply(
    [
      "📱 <b>ProstorShop Bot</b>",
      "",
      "/start — Открыть магазин",
      "/help — Список команд",
      "/search <запрос> — Поиск товара",
      "/catalog — Категории каталога",
      "",
      "Напишите название товара, чтобы найти его.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

bot.command("catalog", async (context) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true, _count: { select: { products: true } } },
  });

  if (categories.length === 0) {
    return context.reply("Каталог пока пуст.");
  }

  const lines = categories.map(
    (c) => `• <a href="${siteUrl}/catalog/${c.slug}">${c.name}</a> (${c._count.products})`,
  );

  return context.reply(["📂 <b>Категории</b>", "", ...lines].join("\n"), {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
});

bot.command("search", async (context) => {
  const query = context.message.text.replace(/^\/search\s*/i, "").trim();

  if (!query) {
    return context.reply("Укажите запрос: /search iPhone 16");
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
      inStock: true,
    },
    take: 5,
    orderBy: { name: "asc" },
    select: { name: true, slug: true, price: true, category: { select: { slug: true } } },
  });

  if (products.length === 0) {
    return context.reply(`По запросу «${query}» ничего не найдено.`);
  }

  const lines = products.map(
    (p) =>
      `• <a href="${siteUrl}/catalog/${p.category.slug}/${p.slug}">${p.name}</a> — ${Number(p.price).toLocaleString("ru-RU")} ₽`,
  );

  return context.reply(
    [`🔍 Результаты для «${query}»:`, "", ...lines].join("\n"),
    { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
  );
});

const useWebhook = process.env.BOT_WEBHOOK_URL;

if (useWebhook) {
  const port = Number(process.env.BOT_WEBHOOK_PORT) || 3001;
  const path = `/bot${token}`;
  bot.launch({ webhook: { domain: useWebhook, port, hookPath: path } }).then(() => {
    console.log(`Telegram bot started in webhook mode on port ${port}.`);
  });
} else {
  bot.launch().then(() => {
    console.log("Telegram bot started in polling mode.");
  });
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));