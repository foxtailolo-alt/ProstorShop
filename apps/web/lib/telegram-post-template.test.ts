import { describe, expect, it } from "vitest";
import { appendTelegramStoreFooter, buildTelegramPostPreviewHtml, buildTelegramPostText } from "./telegram-post-template";

describe("telegram post template", () => {
  it("does not duplicate the store footer", () => {
    const once = appendTelegramStoreFooter("Описание товара", "90 000 ₽");
    const twice = appendTelegramStoreFooter(once, "90 000 ₽");

    expect(twice).toBe(once);
  });

  it("rewrites the existing footer price line when the price changes", () => {
    const initial = appendTelegramStoreFooter("Описание товара", "51 700 ₽");
    const updated = appendTelegramStoreFooter(initial, "<s>51 700 ₽</s> 49 700 ₽");

    expect(updated).toContain("💸 Цена: <s>51 700 ₽</s> 49 700 ₽");
    expect(updated).not.toContain("💸 Цена: 51 700 ₽");
  });

  it("preserves Telegram HTML formatting in the preview", () => {
    const html = buildTelegramPostPreviewHtml({
      title: "Apple Watch Ultra",
      description: "<b>Новая модель</b>\n<tg-spoiler>Секретная цена</tg-spoiler>",
      priceText: "<s>25 700 ₽</s> 22 700 ₽",
    });

    expect(html).toContain("<b>Новая модель</b>");
    expect(html).toContain("<tg-spoiler>Секретная цена</tg-spoiler>");
    expect(html).toContain("<s>25 700 ₽</s> 22 700 ₽");
  });

  it("adds a price line when the footer is not present", () => {
    expect(buildTelegramPostText({
      title: "Apple Watch Ultra",
      description: "Короткое описание",
      priceText: "22 700 ₽",
    })).toContain("💸 Цена: 22 700 ₽");
  });
});