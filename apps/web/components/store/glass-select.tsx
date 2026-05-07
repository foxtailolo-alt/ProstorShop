"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type GlassSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type GlassSelectProps = {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function GlassSelect({
  value,
  options,
  onChange,
  placeholder = "Выберите вариант",
  disabled = false,
}: GlassSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const targetNode = event.target as Node;

      if (!rootRef.current?.contains(targetNode) && !menuRef.current?.contains(targetNode)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateMenuPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`glass-select ${open ? "glass-select-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="glass-select-trigger"
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={`glass-select-value ${selectedOption ? "" : "glass-select-placeholder"}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="glass-select-caret" aria-hidden="true">▾</span>
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              className="glass-select-menu"
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
              role="listbox"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`glass-select-option ${option.value === value ? "glass-select-option-active" : ""}${option.disabled ? " glass-select-option-disabled" : ""}`}
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) {
                      return;
                    }

                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {option.description ? (
                    <span className="glass-select-option-meta">{option.description}</span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}