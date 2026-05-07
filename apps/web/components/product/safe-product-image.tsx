"use client";

import { useMemo, useState } from "react";

type SafeProductImageProps = {
  images: string[];
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
};

export function SafeProductImage({
  images,
  alt,
  className,
  imgClassName,
  fallbackClassName = "product-media-fallback",
}: SafeProductImageProps) {
  const [failedImages, setFailedImages] = useState<string[]>([]);

  const availableImages = useMemo(
    () => images.filter((image, index) => Boolean(image) && images.indexOf(image) === index && !failedImages.includes(image)),
    [failedImages, images],
  );

  const currentImage = availableImages[0] ?? null;

  return (
    <div className={className}>
      {currentImage ? (
        <img
          src={currentImage}
          alt={alt}
          loading="lazy"
          className={imgClassName}
          onError={() => {
            setFailedImages((current) => (current.includes(currentImage) ? current : [...current, currentImage]));
          }}
        />
      ) : (
        <div className={fallbackClassName} />
      )}
    </div>
  );
}