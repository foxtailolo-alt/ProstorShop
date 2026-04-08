"use client";

type ConfirmButtonProps = {
  message?: string;
  className?: string;
  children: React.ReactNode;
};

export function ConfirmButton({
  message = "Вы уверены?",
  className = "button button-secondary",
  children,
}: ConfirmButtonProps) {
  return (
    <button
      type="submit"
      className={className}
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
