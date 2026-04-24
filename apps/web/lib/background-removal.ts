export const DEFAULT_BACKGROUND_REMOVAL_TOLERANCE = 42;
export const MIN_BACKGROUND_REMOVAL_TOLERANCE = 8;
export const MAX_BACKGROUND_REMOVAL_TOLERANCE = 72;

type BackgroundRemovalOptions = {
  tolerance?: number;
};

type RgbSample = {
  red: number;
  green: number;
  blue: number;
};

export function clampBackgroundRemovalTolerance(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BACKGROUND_REMOVAL_TOLERANCE;
  }

  return Math.min(
    MAX_BACKGROUND_REMOVAL_TOLERANCE,
    Math.max(MIN_BACKGROUND_REMOVAL_TOLERANCE, Math.round(value ?? DEFAULT_BACKGROUND_REMOVAL_TOLERANCE)),
  );
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 255;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 255;
  }

  return Math.round(((sorted[middle - 1] ?? 255) + (sorted[middle] ?? 255)) / 2);
}

function sampleCornerRegions(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): RgbSample {
  const sampleSize = Math.max(1, Math.min(24, Math.floor(Math.min(width, height) * 0.08)));
  const redSamples: number[] = [];
  const greenSamples: number[] = [];
  const blueSamples: number[] = [];
  const corners = [
    { startX: 0, startY: 0 },
    { startX: Math.max(0, width - sampleSize), startY: 0 },
    { startX: 0, startY: Math.max(0, height - sampleSize) },
    { startX: Math.max(0, width - sampleSize), startY: Math.max(0, height - sampleSize) },
  ];

  for (const corner of corners) {
    for (let y = corner.startY; y < Math.min(height, corner.startY + sampleSize); y += 1) {
      for (let x = corner.startX; x < Math.min(width, corner.startX + sampleSize); x += 1) {
        const pixelIndex = (y * width + x) * 4;
        if ((pixels[pixelIndex + 3] ?? 255) === 0) {
          continue;
        }

        redSamples.push(pixels[pixelIndex] ?? 255);
        greenSamples.push(pixels[pixelIndex + 1] ?? 255);
        blueSamples.push(pixels[pixelIndex + 2] ?? 255);
      }
    }
  }

  return {
    red: getMedian(redSamples),
    green: getMedian(greenSamples),
    blue: getMedian(blueSamples),
  };
}

function getPixelDistance(
  pixels: Uint8Array | Uint8ClampedArray,
  pixelIndex: number,
  background: RgbSample,
) {
  const red = pixels[pixelIndex] ?? 0;
  const green = pixels[pixelIndex + 1] ?? 0;
  const blue = pixels[pixelIndex + 2] ?? 0;

  return Math.sqrt(
    (red - background.red) ** 2
      + (green - background.green) ** 2
      + (blue - background.blue) ** 2,
  );
}

function getNeighborColorDelta(
  pixels: Uint8Array | Uint8ClampedArray,
  fromPosition: number,
  toPosition: number,
) {
  const fromIndex = fromPosition * 4;
  const toIndex = toPosition * 4;

  return Math.sqrt(
    ((pixels[fromIndex] ?? 0) - (pixels[toIndex] ?? 0)) ** 2
      + ((pixels[fromIndex + 1] ?? 0) - (pixels[toIndex + 1] ?? 0)) ** 2
      + ((pixels[fromIndex + 2] ?? 0) - (pixels[toIndex + 2] ?? 0)) ** 2,
  );
}

function buildBorderConnectedMask(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  background: RgbSample,
  threshold: number,
) {
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  const edgeBarrier = Math.max(6, Math.round(threshold * 0.14));
  let queueStart = 0;
  let queueEnd = 0;

  function tryEnqueue(position: number, fromPosition?: number) {
    if (position < 0 || position >= totalPixels || mask[position]) {
      return;
    }

    const pixelIndex = position * 4;
    const alpha = pixels[pixelIndex + 3] ?? 255;
    if (alpha === 0) {
      mask[position] = 1;
      queue[queueEnd] = position;
      queueEnd += 1;
      return;
    }

    if (getPixelDistance(pixels, pixelIndex, background) > threshold) {
      return;
    }

    if (
      typeof fromPosition === "number"
      && getNeighborColorDelta(pixels, fromPosition, position) > edgeBarrier
    ) {
      return;
    }

    mask[position] = 1;
    queue[queueEnd] = position;
    queueEnd += 1;
  }

  for (let x = 0; x < width; x += 1) {
    tryEnqueue(x);
    tryEnqueue((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    tryEnqueue(y * width);
    tryEnqueue(y * width + (width - 1));
  }

  while (queueStart < queueEnd) {
    const position = queue[queueStart] ?? 0;
    queueStart += 1;

    const x = position % width;
    const y = Math.floor(position / width);

    if (x > 0) {
      tryEnqueue(position - 1, position);
    }
    if (x < width - 1) {
      tryEnqueue(position + 1, position);
    }
    if (y > 0) {
      tryEnqueue(position - width, position);
    }
    if (y < height - 1) {
      tryEnqueue(position + width, position);
    }
  }

  return mask;
}

export function applyBackgroundRemoval(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: BackgroundRemovalOptions = {},
) {
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return pixels;
  }

  const tolerance = clampBackgroundRemovalTolerance(options.tolerance);
  const fadeDistance = tolerance * 0.5;
  const background = sampleCornerRegions(pixels, width, height);
  const backgroundMask = buildBorderConnectedMask(pixels, width, height, background, tolerance + fadeDistance);

  for (let index = 0; index < totalPixels; index += 1) {
    if (!backgroundMask[index]) {
      continue;
    }

    const pixelIndex = index * 4;
    const distance = getPixelDistance(pixels, pixelIndex, background);

    if (distance < tolerance) {
      pixels[pixelIndex + 3] = 0;
    } else if (distance < tolerance + fadeDistance) {
      const alpha = Math.round(((distance - tolerance) / fadeDistance) * 255);
      pixels[pixelIndex + 3] = Math.min(pixels[pixelIndex + 3] ?? 255, alpha);
    }
  }

  return pixels;
}