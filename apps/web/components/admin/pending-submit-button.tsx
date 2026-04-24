"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className = "button button-primary button-sm",
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span>{pending ? pendingLabel : idleLabel}</span>
    </button>
  );
}