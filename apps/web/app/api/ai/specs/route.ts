import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth/session";

export async function POST(request: NextRequest) {
  await requirePermission("products", "write");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
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

  // Use Responses API with web_search tool for factual data
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      tools: [{ type: "web_search_preview" }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ error: `OpenAI API error: ${response.status}`, details: errorText }, { status: 502 });
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
