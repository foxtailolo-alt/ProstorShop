"use client";

import { useId, useState } from "react";

type ProductDescriptionProps = {
  text: string;
};

const COLLAPSIBLE_TEXT_THRESHOLD = 260;

export function ProductDescription({ text }: ProductDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const isCollapsible = text.trim().length > COLLAPSIBLE_TEXT_THRESHOLD;

  return (
    <div className={`product-page-summary-block${expanded ? " product-page-summary-block-expanded" : ""}`}>
      <p
        id={descriptionId}
        className={`product-page-summary${isCollapsible && !expanded ? " product-page-summary-collapsed" : ""}`}
      >
        {text}
      </p>

      {isCollapsible ? (
        <button
          type="button"
          className="product-page-summary-toggle"
          aria-expanded={expanded}
          aria-controls={descriptionId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Свернуть описание" : "Показать полностью"}
        </button>
      ) : null}
    </div>
  );
}