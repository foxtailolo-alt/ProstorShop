import { describe, expect, it } from "vitest";
import { applyBackgroundRemoval, clampBackgroundRemovalTolerance, DEFAULT_BACKGROUND_REMOVAL_TOLERANCE } from "./background-removal";

function createImage(width: number, height: number, fill: [number, number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const pixelIndex = index * 4;
    pixels[pixelIndex] = fill[0];
    pixels[pixelIndex + 1] = fill[1];
    pixels[pixelIndex + 2] = fill[2];
    pixels[pixelIndex + 3] = fill[3];
  }

  return pixels;
}

function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgba: [number, number, number, number],
) {
  const pixelIndex = (y * width + x) * 4;
  pixels[pixelIndex] = rgba[0];
  pixels[pixelIndex + 1] = rgba[1];
  pixels[pixelIndex + 2] = rgba[2];
  pixels[pixelIndex + 3] = rgba[3];
}

function getAlpha(pixels: Uint8ClampedArray, width: number, x: number, y: number) {
  return pixels[(y * width + x) * 4 + 3];
}

describe("background removal helper", () => {
  it("clamps invalid tolerance values to the supported range", () => {
    expect(clampBackgroundRemovalTolerance(Number.NaN)).toBe(DEFAULT_BACKGROUND_REMOVAL_TOLERANCE);
    expect(clampBackgroundRemovalTolerance(-100)).toBe(8);
    expect(clampBackgroundRemovalTolerance(999)).toBe(72);
  });

  it("preserves light foreground regions that are not connected to the border", () => {
    const width = 5;
    const height = 5;
    const pixels = createImage(width, height, [255, 255, 255, 255]);

    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        setPixel(pixels, width, x, y, [244, 244, 244, 255]);
      }
    }

    applyBackgroundRemoval(pixels, width, height, { tolerance: 42 });

    expect(getAlpha(pixels, width, 0, 0)).toBe(0);
    expect(getAlpha(pixels, width, 2, 2)).toBe(255);
  });

  it("keeps a border-touching product pixel when its color is not background-like", () => {
    const width = 5;
    const height = 5;
    const pixels = createImage(width, height, [255, 255, 255, 255]);

    setPixel(pixels, width, 0, 0, [30, 30, 30, 255]);
    setPixel(pixels, width, 2, 2, [60, 60, 60, 255]);

    applyBackgroundRemoval(pixels, width, height, { tolerance: 42 });

    expect(getAlpha(pixels, width, 0, 0)).toBe(255);
    expect(getAlpha(pixels, width, 4, 4)).toBe(0);
    expect(getAlpha(pixels, width, 2, 2)).toBe(255);
  });
});