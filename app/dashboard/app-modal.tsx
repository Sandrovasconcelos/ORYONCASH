"use client";

import { useEffect } from "react";

export function AppModal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  tone?: "danger" | "success" | "neutral" | "warning";
  size?: "default" | "wide";
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center overflow-hidden whitespace-normal bg-black/60 p-2 backdrop-blur-[1px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden whitespace-normal rounded-card border border-brand-gray-300 bg-white text-brand-black shadow-brand-md sm:max-h-[88vh] ${
          size === "wide" ? "max-w-[960px]" : "max-w-[680px]"
        }`}
      >
        <div className="relative border-b border-brand-gray-300/70 bg-brand-gray-100/95 px-5 py-5 pr-16 text-left sm:px-7 sm:py-6 sm:text-center">
          <p className="oc-eyebrow mb-3">{eyebrow}</p>
          <h2 id="app-modal-title" className="oc-title break-words text-2xl leading-tight">
            {title}
          </h2>
          {description && (
            <div className="mx-auto mt-2 max-w-[560px] break-words text-sm leading-6 text-brand-gray-500">
              {description}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            title="Fechar"
            className="absolute right-4 top-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-gray-300 bg-white text-xl font-bold leading-none text-brand-gray-500 hover:border-brand-red/40 hover:text-brand-red sm:right-5 sm:top-5"
          >
            ×
          </button>
        </div>

        {children && (
          <div className="overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-7">
            <div className="min-w-0 break-words">{children}</div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-brand-gray-300/70 bg-white/95 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          {footer}
        </div>
      </section>
    </div>
  );
}
