import { describe, expect, it } from "vitest";
import { buildPendingPurchasedDevices } from "./profile";
import type { TradeInSnapshotGraph } from "./trade-in-snapshot";

const testTradeInSnapshot: TradeInSnapshotGraph = {
  version: 1,
  sourceName: "test",
  pricingCity: "moscow",
  status: "active",
  importedAt: "2026-05-08T00:00:00.000Z",
  categories: [
    {
      categoryCode: "iphone",
      title: "iPhone",
      sortOrder: 1,
      isEnabled: true,
      questions: [],
      models: [
        {
          code: "iphone_13_128gb_blue",
          title: "iPhone 13 128GB Blue",
          metadata: {},
          sortOrder: 1,
          isEnabled: true,
        },
        {
          code: "iphone_16_128gb_pink",
          title: "iPhone 16 128GB Pink",
          metadata: {},
          sortOrder: 2,
          isEnabled: true,
        },
      ],
    },
    {
      categoryCode: "apple_watch",
      title: "Apple Watch",
      sortOrder: 2,
      isEnabled: true,
      questions: [],
      models: [
        {
          code: "apple_watch_s10_46mm_silver",
          title: "Apple Watch S10 46mm Silver",
          metadata: {},
          sortOrder: 1,
          isEnabled: true,
        },
      ],
    },
  ],
};

describe("profile pending purchased devices", () => {
  it("keeps other completed items from the same order available for adding", () => {
    const pendingDevices = buildPendingPurchasedDevices(
      [
        {
          id: "order-1",
          orderNumber: "1001",
          status: "completed",
          createdAt: new Date("2026-05-08T10:00:00.000Z"),
          items: [
            {
              id: "item-iphone",
              variantLabel: "128 ГБ",
              product: {
                name: "iPhone 16 128Gb | Pink",
                brand: "Apple",
                imageUrl: null,
              },
            },
            {
              id: "item-watch",
              variantLabel: "46 мм",
              product: {
                name: "Apple Watch S10 46mm | Silver",
                brand: "Trade-in часы",
                imageUrl: null,
              },
            },
          ],
        },
      ],
      [
        {
          categoryCode: "iphone",
          deviceModelCode: null,
          orderId: "order-1",
          model: "iPhone 16 128Gb | Pink",
        },
      ],
      testTradeInSnapshot,
    );

    expect(pendingDevices).toHaveLength(1);
    expect(pendingDevices[0]).toMatchObject({
      orderId: "order-1",
      orderItemId: "item-watch",
      categoryCode: "apple_watch",
      model: "Apple Watch S10 46mm | Silver",
    });
  });

  it("hides a completed purchase when the same model is already in profile", () => {
    const pendingDevices = buildPendingPurchasedDevices(
      [
        {
          id: "order-2",
          orderNumber: "1002",
          status: "completed",
          createdAt: new Date("2026-05-08T11:00:00.000Z"),
          items: [
            {
              id: "item-iphone-13",
              variantLabel: "128GB Blue",
              product: {
                name: "iPhone 13",
                brand: "Apple",
                imageUrl: null,
              },
            },
          ],
        },
      ],
      [
        {
          categoryCode: "smartphone",
          deviceModelCode: "iphone_13_128gb_blue",
          orderId: null,
          model: "iPhone 13",
        },
      ],
      testTradeInSnapshot,
    );

    expect(pendingDevices).toHaveLength(0);
  });

  it("hides a completed purchase when an older profile device can only be matched through inferred model code", () => {
    const pendingDevices = buildPendingPurchasedDevices(
      [
        {
          id: "order-3",
          orderNumber: "1003",
          status: "completed",
          createdAt: new Date("2026-05-08T12:00:00.000Z"),
          items: [
            {
              id: "item-iphone-13-blue",
              variantLabel: "128GB Blue",
              product: {
                name: "iPhone 13",
                brand: "Apple",
                imageUrl: null,
              },
            },
          ],
        },
      ],
      [
        {
          categoryCode: "smartphone",
          deviceModelCode: null,
          orderId: null,
          model: "iPhone 13",
          storage: "128GB Blue",
        },
      ],
      testTradeInSnapshot,
    );

    expect(pendingDevices).toHaveLength(0);
  });

  it("hides a completed purchase when the saved purchase device uses normalized model text", () => {
    const pendingDevices = buildPendingPurchasedDevices(
      [
        {
          id: "order-4",
          orderNumber: "1004",
          status: "completed",
          createdAt: new Date("2026-05-08T13:00:00.000Z"),
          items: [
            {
              id: "item-watch-s10",
              variantLabel: null,
              product: {
                name: "Apple Watch S10 46mm | Silver",
                brand: "Trade-in часы",
                imageUrl: null,
              },
            },
          ],
        },
      ],
      [
        {
          categoryCode: "apple_watch",
          deviceModelCode: "aws10",
          orderId: "order-4",
          model: "Series 10",
          storage: null,
        },
      ],
      testTradeInSnapshot,
    );

    expect(pendingDevices).toHaveLength(0);
  });
});