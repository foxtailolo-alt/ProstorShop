import { Telegraf } from "telegraf";

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

bot.launch().then(() => {
  console.log("Telegram bot started.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));