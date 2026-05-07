import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTradeInPricingPayload, quoteTradeInSelection, type TradeInSnapshotGraph } from "./trade-in-snapshot";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildTradeInPricingPayload", () => {
  it("omits samsung model_series for live pricing payloads", () => {
    const snapshot: TradeInSnapshotGraph = {
      version: 1,
      sourceName: "test",
      pricingCity: "moscow",
      status: "active",
      importedAt: new Date().toISOString(),
      categories: [
        {
          categoryCode: "samsung",
          title: "Samsung",
          sortOrder: 0,
          isEnabled: true,
          models: [
            {
              code: "galaxy_s25",
              title: "Galaxy S25",
              metadata: { modelSeries: "S25" },
              sortOrder: 0,
              isEnabled: true,
            },
          ],
          questions: [],
        },
      ],
    };

    expect(
      buildTradeInPricingPayload(snapshot, {
        categoryCode: "samsung",
        modelCode: "galaxy_s25",
        answers: {
          memory: "128",
          exterier_condition_android: "best",
        },
      }),
    ).toEqual({
      vendor: "samsung",
      models_android: "galaxy_s25",
      memory: "128",
      exterier_condition_android: "best",
    });
  });
});

describe("quoteTradeInSelection", () => {
  it("falls back to the nearest valid Mac configuration after an upstream 404", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Cant find any devices for selected criteria" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        macbookair: {
          device_abbr: "macbookair",
          params: {
            cpu: { group_abbr: "cpu", vals: [] },
            memory: { group_abbr: "memory", vals: [{ abbr: "128", name: "128 ГБ" }] },
            inches: { group_abbr: "inches", vals: [{ abbr: "13", name: "13" }] },
            ram: { group_abbr: "ram", vals: [{ abbr: "8", name: "8 ГБ" }] },
            touch_bar: { group_abbr: "touch_bar", vals: [{ abbr: "no", name: "Нет Тач бара" }] },
            is_retina: { group_abbr: "is_retina", vals: [{ abbr: true, name: "Retina" }] },
          },
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Cant find any devices for selected criteria" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        macbookair: {
          device_abbr: "macbookair",
          params: {
            cpu: { group_abbr: "cpu", vals: [{ abbr: "intel", name: "Intel" }] },
            memory: { group_abbr: "memory", vals: [{ abbr: "128", name: "128 ГБ" }] },
            inches: { group_abbr: "inches", vals: [{ abbr: "13", name: "13" }] },
            ram: { group_abbr: "ram", vals: [{ abbr: "8", name: "8 ГБ" }] },
            touch_bar: { group_abbr: "touch_bar", vals: [{ abbr: "no", name: "Нет Тач бара" }] },
            is_retina: { group_abbr: "is_retina", vals: [{ abbr: true, name: "Retina" }] },
          },
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ counted_price: 24000, bonus_for_use: 2000 }), { status: 200 }));

    const snapshot: TradeInSnapshotGraph = {
      version: 1,
      sourceName: "test",
      pricingCity: "moscow",
      status: "active",
      importedAt: new Date().toISOString(),
      categories: [
        {
          categoryCode: "mac",
          title: "Mac",
          sortOrder: 0,
          isEnabled: true,
          models: [
            {
              code: "macbookair",
              title: "MacBook Air",
              metadata: {
                params: {
                  year: {
                    vals: [
                      { abbr: "2017", name: "2017" },
                      { abbr: "2020", name: "2020" },
                    ],
                  },
                },
              },
              sortOrder: 0,
              isEnabled: true,
            },
          ],
          questions: [],
        },
      ],
    };

    const quote = await quoteTradeInSelection(snapshot, {
      categoryCode: "mac",
      modelCode: "macbookair",
      answers: {
        year: "2017",
        cpu: "applem1",
        inches: "13",
        memory: "128",
        ram: "8",
        touch_bar: "no",
        is_retina: "true",
        damaged: "false",
      },
    });

    expect(quote.amount).toBe(24000);
    expect(quote.trace[0]?.label).toContain("2020");
  });
});