import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mockRequirePermission = vi.fn();

vi.mock("../../../../lib/auth/session", () => ({
  requirePermission: mockRequirePermission,
}));

describe("AI specs route", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = originalApiKey;
    mockRequirePermission.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
  });

  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ name: "iPhone 16" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "OPENAI_API_KEY not configured" });
    expect(mockRequirePermission).toHaveBeenCalledWith("products", "write");
  });

  it("returns 400 when product name is missing", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_PROXY_URL;
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ brand: "Apple" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Product name is required" });
  });

  it("returns 502 when OpenAI responds with an error", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_PROXY_URL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("rate_limited"),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ name: "iPhone 16", brand: "Apple" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "OpenAI API error: 429",
      details: "rate_limited",
    });
  });

  it("returns a clear operator message when OpenAI blocks the server region", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_PROXY_URL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        error: {
          code: "unsupported_country_region_territory",
          message: "Country, region, or territory not supported",
          type: "request_forbidden",
        },
      })),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ name: "iPhone 16", brand: "Apple" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "AI provider blocked this server region. Move the AI proxy to a supported region or use another OpenAI-compatible upstream.",
      details: "Country, region, or territory not supported",
    });
  });

  it("parses markdown-wrapped JSON specs from Responses API", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_PROXY_URL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "```json\n{\"Дисплей\":\"6.1 дюйма\",\"Память\":\"128 ГБ\"}\n```",
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ name: "iPhone 16", brand: "Apple", category: "smartphones" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      specs: {
        "Дисплей": "6.1 дюйма",
        "Память": "128 ГБ",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when AI response cannot be parsed as JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_PROXY_URL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "not-json",
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ name: "Galaxy S25" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to parse AI response",
      raw: "not-json",
    });
  });

  it("works in proxy mode without OPENAI_API_KEY", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_PROXY_URL = "https://proxy.example.com";
    process.env.OPENAI_PROXY_SECRET = "proxy-secret";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: '{"Процессор":"Apple M4"}',
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/ai/specs", {
      method: "POST",
      body: JSON.stringify({ name: "iPad Pro" }),
      headers: { "Content-Type": "application/json" },
    }) as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      specs: {
        "Процессор": "Apple M4",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example.com/openai/responses",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Proxy-Secret": "proxy-secret",
        },
      }),
    );
  });
});