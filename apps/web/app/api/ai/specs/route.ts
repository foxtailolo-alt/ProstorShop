import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth/session";

type OpenAiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
};

function getOpenAiProxyUrl() {
  return process.env.OPENAI_PROXY_URL?.trim() ?? "";
}

function getOpenAiEndpoint() {
  const proxyUrl = getOpenAiProxyUrl();

  if (proxyUrl) {
    return new URL("/openai/responses", proxyUrl).toString();
  }

  return "https://api.openai.com/v1/responses";
}

function getOpenAiHeaders(apiKey?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const proxySecret = process.env.OPENAI_PROXY_SECRET?.trim();
  const proxyUrl = getOpenAiProxyUrl();

  if (proxyUrl) {
    if (proxySecret) {
      headers["X-Proxy-Secret"] = proxySecret;
    }

    return headers;
  }

  headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function parseOpenAiError(errorText: string): OpenAiErrorPayload | null {
  try {
    return JSON.parse(errorText) as OpenAiErrorPayload;
  } catch {
    return null;
  }
}

function formatOpenAiError(status: number, errorText: string) {
  const parsed = parseOpenAiError(errorText);
  const errorCode = parsed?.error?.code?.trim();
  const errorMessage = parsed?.error?.message?.trim();

  if (errorCode === "unsupported_country_region_territory") {
    return {
      error: "AI provider blocked this server region. Move the AI proxy to a supported region or use another OpenAI-compatible upstream.",
      details: errorMessage || errorText,
    };
  }

  if (errorMessage) {
    return {
      error: `OpenAI API error: ${status}. ${errorMessage}`,
      details: errorText,
    };
  }

  return {
    error: `OpenAI API error: ${status}`,
    details: errorText,
  };
}

export async function POST(request: NextRequest) {
  await requirePermission("products", "write");

  const proxyUrl = getOpenAiProxyUrl();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!proxyUrl && !apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { name, brand, category } = body as { name?: string; brand?: string; category?: string };

  if (!name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  const prompt = `Найди в интернете точные характеристики этого товара и верни их в формате JSON.

Товар: ${name}
Бренд: ${brand || "не указан"}
Категория: ${category || "не указана"}

ПРАВИЛА:
1. Используй ТОЛЬКО данные найденные в интернете — НЕ ВЫДУМЫВАЙ
2. Если характеристика не найдена в источниках — НЕ включай её
3. Ключи — на русском языке (Дисплей, Процессор, Оперативная память и т.д.)
4. Значения — краткие, фактические (например "6.7 дюймов, OLED, 120 Гц")
5. Включи 8-15 ключевых характеристик
6. Ответ — ТОЛЬКО валидный JSON объект, без markdown, без пояснений`;

  const payload = {
    model: "gpt-4o-mini",
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    temperature: 0,
  };

  // Use Responses API with web_search tool for factual data
  const response = await fetch(getOpenAiEndpoint(), {
    method: "POST",
    headers: getOpenAiHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(formatOpenAiError(response.status, errorText), { status: 502 });
  }

  const data = await response.json();
  // Responses API: find the output_text content
  const outputItem = data.output?.find((o: { type: string }) => o.type === "message");
  const content = outputItem?.content?.find((c: { type: string }) => c.type === "output_text")?.text?.trim() ?? "";

  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const specs = JSON.parse(cleaned);

    if (typeof specs !== "object" || Array.isArray(specs)) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });
    }

    return NextResponse.json({ specs });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
  }
}
