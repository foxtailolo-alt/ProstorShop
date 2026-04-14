import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth/session";

type OpenAiErrorPayload = {
  error?: { code?: string; message?: string };
};

function getOpenAiProxyUrl() {
  return process.env.OPENAI_PROXY_URL?.trim() ?? "";
}

function getOpenAiEndpoint() {
  const proxyUrl = getOpenAiProxyUrl();
  if (proxyUrl) return new URL("/openai/responses", proxyUrl).toString();
  return "https://api.openai.com/v1/responses";
}

function getOpenAiHeaders(apiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const proxyUrl = getOpenAiProxyUrl();
  const proxySecret = process.env.OPENAI_PROXY_SECRET?.trim();

  if (proxyUrl) {
    if (proxySecret) headers["X-Proxy-Secret"] = proxySecret;
    return headers;
  }
  headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export async function POST(request: NextRequest) {
  await requirePermission("categories", "write");

  const proxyUrl = getOpenAiProxyUrl();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!proxyUrl && !apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { categoryName, parentPath } = body as {
    categoryName?: string;
    parentPath?: string;
  };

  if (!categoryName) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  const parentInfo = parentPath ? `\nРодительская категория: ${parentPath}` : "";

  const prompt = `Ты — SEO-специалист интернет-магазина электроники «Простор» в Нижнем Новгороде.
Сайт продаёт iPhone, Samsung, MacBook, iPad, аксессуары, услуги сервиса и trade-in.
Целевой регион: Нижний Новгород и Нижегородская область.

Задача: сгенерируй SEO-метаданные ИМЕННО для категории «${categoryName}».${parentInfo}

ВАЖНО: SEO должно быть про «${categoryName}», а НЕ про родительскую категорию. Все ключевые слова, заголовок и описание должны быть релевантны именно «${categoryName}».

ТРЕБОВАНИЯ:
1. Найди в интернете актуальное семантическое ядро для «${categoryName}» в Нижнем Новгороде
2. seoTitle — до 60 символов, включи «${categoryName}» + гео «Нижний Новгород» или «в Нижнем Новгороде». Формат: «${categoryName} купить в Нижнем Новгороде | Простор»
3. seoDescription — 140-160 символов, включи 2-3 ключевых запроса из ядра для «${categoryName}», УТП (цены, гарантия, trade-in), призыв к действию, гео-привязку
4. seoKeywords — массив из 8-12 ключевых фраз из семантического ядра для «${categoryName}», от ВЧ к НЧ, все с гео-привязкой к Нижнему Новгороду где уместно

Ответ — ТОЛЬКО валидный JSON:
{
  "seoTitle": "...",
  "seoDescription": "...",
  "seoKeywords": ["...", "..."]
}

Без markdown, без пояснений.`;

  const payload = {
    model: "gpt-4o-mini",
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    temperature: 0,
  };

  const response = await fetch(getOpenAiEndpoint(), {
    method: "POST",
    headers: getOpenAiHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const parsed = (() => { try { return JSON.parse(errorText) as OpenAiErrorPayload; } catch { return null; } })();
    const msg = parsed?.error?.message ?? errorText;
    return NextResponse.json({ error: `OpenAI API error: ${response.status}. ${msg}` }, { status: 502 });
  }

  const data = await response.json();
  const outputItem = data.output?.find((o: { type: string }) => o.type === "message");
  const content = outputItem?.content?.find((c: { type: string }) => c.type === "output_text")?.text?.trim() ?? "";

  try {
    const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const seo = JSON.parse(cleaned);

    if (typeof seo !== "object" || !seo.seoTitle || !seo.seoDescription) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });
    }

    return NextResponse.json({
      seoTitle: String(seo.seoTitle),
      seoDescription: String(seo.seoDescription),
      seoKeywords: Array.isArray(seo.seoKeywords) ? seo.seoKeywords.map(String) : [],
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
  }
}
