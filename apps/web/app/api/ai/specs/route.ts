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

  const prompt = `Найди в интернете ТОЧНЫЕ официальные характеристики этого товара.

Товар: ${name}
Бренд: ${brand || "не указан"}
Категория: ${category || "не указана"}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. Ищи ТОЛЬКО на официальных сайтах производителя (apple.com, samsung.com и т.д.), GSMArena, iXBT, 4PDA
2. Используй ИСКЛЮЧИТЕЛЬНО данные из найденных источников — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать или додумывать
3. Если товар ещё не вышел или характеристики официально не подтверждены — верни {"error": "Официальные характеристики не найдены"}
4. Если конкретная характеристика НЕ найдена в источниках — НЕ включай её. Лучше 5 точных, чем 15 с ошибками
5. Перепроверь каждое значение — оно должно точно совпадать с данными из источника
6. НЕ СМЕШИВАЙ характеристики разных моделей (Pro ≠ Pro Max ≠ обычная ≠ Plus)
7. Ключи — на русском языке (Дисплей, Процессор, Оперативная память, Аккумулятор и т.д.)
8. Значения — краткие, фактические (например "6.7 дюймов, OLED, 120 Гц")
9. Включи 8-15 ключевых характеристик
10. Ответ — ТОЛЬКО валидный JSON объект, без markdown, без пояснений

ЧАСТЫЕ ОШИБКИ (НЕ ДОПУСКАЙ):
- Указание ёмкости аккумулятора "на глаз" без подтверждённого источника
- Смешивание характеристик разных моделей линейки
- Использование слухов и утечек вместо подтверждённых данных`;

  const payload = {
    model: "gpt-4o-mini",
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    temperature: 0,
    text: {
      format: { type: "json_object" },
    },
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

    if (specs.error) {
      return NextResponse.json({ error: String(specs.error) }, { status: 404 });
    }

    return NextResponse.json({ specs });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
  }
}
