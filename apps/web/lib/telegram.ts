import { buildTelegramMiniAppLaunchUrl } from "@prostor/core";

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function buildMiniAppUrl(productSlug?: string) {
  const baseUrl = process.env.TELEGRAM_MINI_APP_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/mini-app`;
  const url = new URL(baseUrl);

  if (productSlug) {
    url.searchParams.set("product", productSlug);
    url.searchParams.set("source", "telegram-post");
  }

  return url.toString();
}

export function buildMiniAppProductUrl(productSlug: string) {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();

  if (!botUsername) {
    return buildMiniAppUrl(productSlug);
  }

  return buildTelegramMiniAppLaunchUrl({
    botUsername,
    shortName: process.env.TELEGRAM_MINI_APP_SHORT_NAME,
    startParam: productSlug,
  });
}

export async function sendTelegramPost(input: {
  text: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string | null;
}) {
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getRequiredEnv("TELEGRAM_POST_CHAT_ID");

  const replyMarkup: TelegramReplyMarkup = {
    inline_keyboard: [[{ text: input.buttonText, url: input.buttonUrl }]],
  };

  const method = input.imageUrl ? "sendPhoto" : "sendMessage";
  const requestPayload = input.imageUrl
    ? {
        chat_id: chatId,
        photo: input.imageUrl,
        caption: input.text,
        reply_markup: replyMarkup,
      }
    : {
        chat_id: chatId,
        text: input.text,
        reply_markup: replyMarkup,
        disable_web_page_preview: false,
      };

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    throw new Error(`Telegram API responded with ${response.status}.`);
  }

  const responsePayload = (await response.json()) as {
    ok: boolean;
    result?: { message_id: number };
    description?: string;
  };

  if (!responsePayload.ok || !responsePayload.result) {
    throw new Error(responsePayload.description ?? "Telegram API error.");
  }

  return responsePayload.result.message_id;
}