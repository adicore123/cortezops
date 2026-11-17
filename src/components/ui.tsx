"use client";

import { ReactNode, useEffect } from "react";

// ─── כפתורים בסגנון קורטז (פיל) ────────────────────────────────────────────

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark" | "outline" | "ghost" | "green" | "danger-soft";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Btn({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "min-h-9 px-4 text-sm", md: "min-h-11 px-5 text-[15px]", lg: "min-h-[52px] px-7 text-base" };
  const variants = {
    primary: "bg-cz-red text-white hover:bg-cz-red-dark shadow-[0_6px_16px_rgba(200,10,4,.25)]",
    dark: "bg-cz-ink text-white hover:bg-black",
    outline: "border border-cz-line bg-white text-cz-ink hover:border-cz-red hover:text-cz-red",
    ghost: "text-cz-mut hover:text-cz-ink hover:bg-cz-sand",
    green: "bg-cz-green text-white hover:brightness-110",
    "danger-soft": "bg-cz-red-soft text-cz-red hover:bg-cz-red hover:text-white",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="טוען">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ─── תג סטטוס צבעוני ────────────────────────────────────────────────────────

export type Tone = "gray" | "red" | "amber" | "blue" | "purple" | "green" | "dark";

const TONES: Record<Tone, string> = {
  gray: "bg-cz-sand text-cz-ink/80",
  red: "bg-cz-red-soft text-cz-red",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-sky-100 text-sky-800",
  purple: "bg-violet-100 text-violet-800",
  green: "bg-cz-green-soft text-cz-green",
  dark: "bg-cz-ink text-white",
};

export function Badge({ tone = "gray", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

// ─── מודל ────────────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, children, wide,
}: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-cz-asphalt/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-cz bg-white shadow-2xl`}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cz-line-soft bg-white/95 backdrop-blur px-5 py-4">
            <h3 className="font-display text-lg font-extrabold">{title}</h3>
            <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-cz-sand text-cz-mut" aria-label="סגירה">✕</button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── מצבים שונים ────────────────────────────────────────────────────────────

export function EmptyState({ icon = "🗂️", title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-cz border border-dashed border-cz-line bg-white/60 py-14 px-6 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-display font-bold text-lg">{title}</div>
      {hint && <div className="text-sm text-cz-mut max-w-sm">{hint}</div>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl sm:text-[28px] font-extrabold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-cz-mut">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, error, hint, className = "" }: { label: string; children: ReactNode; error?: string; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <div className="mt-1 text-xs text-cz-fog">{hint}</div>}
      {error && <div className="mt-1 text-xs font-bold text-cz-red">{error}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "ink", href }: { label: string; value: ReactNode; tone?: "ink" | "red" | "green" | "purple" | "amber"; href?: string }) {
  const colors: Record<string, string> = {
    ink: "text-cz-ink",
    red: "text-cz-red",
    green: "text-cz-green",
    purple: "text-violet-700",
    amber: "text-amber-700",
  };
  const inner = (
    <div className="card p-4 sm:p-5 transition-shadow hover:shadow-md">
      <div className={`num text-3xl font-bold ${colors[tone]}`}>{value}</div>
      <div className="mt-1 text-[13px] font-semibold text-cz-mut">{label}</div>
    </div>
  );
  return href ? <a href={href} className="block">{inner}</a> : inner;
}

export { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
