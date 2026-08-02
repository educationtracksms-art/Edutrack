import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "success" | "warning" | "muted" | "danger"; children: ReactNode }) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-accent/15 text-accent",
    muted: "bg-muted text-muted-foreground",
    danger: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "accent" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    accent: "bg-accent text-accent-foreground hover:opacity-90",
    ghost: "border border-border bg-background text-foreground hover:bg-muted",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 sm:w-auto ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function ResponsiveTable({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  return (
    <>
      <div className="hidden md:block">{desktop}</div>
      <div className="space-y-3 md:hidden">{mobile}</div>
    </>
  );
}
