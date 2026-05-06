type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  return (
    <span className={["brand-logo", compact ? "is-compact" : "", className ?? ""].filter(Boolean).join(" ")}>
      <img
        className="brand-logo-image"
        src="/branding/prostor-logo.png"
        alt="Простор"
      />
    </span>
  );
}