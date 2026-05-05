import { buildTelegramMiniAppLaunchUrl } from "@prostor/core";

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

type TelegramApiResponse = {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
};

type TelegramSendInput = {
  chatId: string;
  text: string;
  buttonText?: string;
  buttonUrl?: string;
  imageUrl?: string | null;
};

async function buildTelegramPhotoUpload(imageUrl: string) {
  const response = await fetch(imageUrl, {
    headers: {
      Accept: "image/*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to download Telegram image: ${response.status}.`);
  }

  const sharp = (await import("sharp")).default;
  const inputBuffer = Buffer.from(await response.arrayBuffer());
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const sourceName = (imageUrl
    .split("?")[0] ?? "")
    .split("/")
    .at(-1) ?? "";
  const normalizedName = sourceName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return new File([new Uint8Array(outputBuffer)], `${normalizedName || "telegram-photo"}.jpg`, {
    type: "image/jpeg",
  });
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

async function callTelegramApi(input: {
  botToken: string;
  method: "sendPhoto" | "sendMessage";
  payload: BodyInit | Record<string, unknown>;
  contentType?: string;
}) {
  const body: BodyInit = input.contentType === "application/json"
    ? JSON.stringify(input.payload)
    : input.payload as BodyInit;

  const response = await fetch(`https://api.telegram.org/bot${input.botToken}/${input.method}`, {
    method: "POST",
    headers: input.contentType
      ? {
          "Content-Type": input.contentType,
        }
      : undefined,
    body,
  });

  const responsePayload = (await response.json()) as TelegramApiResponse;

  if (!response.ok || !responsePayload.ok || !responsePayload.result) {
    throw new Error(responsePayload.description ?? `Telegram API responded with ${response.status}.`);
  }

  return responsePayload.result.message_id;
}

export async function sendTelegramDirectMessage(input: TelegramSendInput) {
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");

  const replyMarkup: TelegramReplyMarkup | undefined = input.buttonText && input.buttonUrl
    ? {
        inline_keyboard: [[{ text: input.buttonText, url: input.buttonUrl }]],
      }
    : undefined;

  if (input.imageUrl) {
    const formData = new FormData();
    formData.set("chat_id", input.chatId);
    formData.set("photo", await buildTelegramPhotoUpload(input.imageUrl));
    formData.set("caption", input.text);
    formData.set("parse_mode", "HTML");
    if (replyMarkup) {
      formData.set("reply_markup", JSON.stringify(replyMarkup));
    }

    return callTelegramApi({
      botToken,
      method: "sendPhoto",
      payload: formData,
    });
  }

  return callTelegramApi({
    botToken,
    method: "sendMessage",
    payload: {
      chat_id: input.chatId,
      text: input.text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      disable_web_page_preview: false,
    },
    contentType: "application/json",
  });
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
  const chatId = getRequiredEnv("TELEGRAM_POST_CHAT_ID");

  return sendTelegramDirectMessage({
    chatId,
    text: input.text,
    buttonText: input.buttonText,
    buttonUrl: input.buttonUrl,
    imageUrl: input.imageUrl,
  });
}