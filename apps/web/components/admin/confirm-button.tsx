"use client";

type ConfirmButtonProps = {
  message?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export function ConfirmButton({
  message = "Вы уверены?",
  className = "button button-secondary",
  style,
  children,
}: ConfirmButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      onClick={(e) => {
        if (!confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
