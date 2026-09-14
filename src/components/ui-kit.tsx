import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow = "Overview",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="no-print mb-5 flex flex-col gap-3 rounded-3xl border border-border bg-[linear-gradient(135deg,var(--color-card),var(--color-primary-soft))] p-5 shadow-[var(--shadow-card)] sm:mb-6 sm:gap-4 sm:p-7">
      <div className="min-w-0">
        <p className="mb-3 inline-flex rounded-full border border-primary/10 bg-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="page-actions flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6 ${className}`}
    >
      {title && (
        <h2 className="mb-5 text-base font-bold tracking-tight text-foreground">{title}</h2>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="group rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted" | "danger";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-accent/15 text-accent",
    muted: "bg-muted text-muted-foreground",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
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
    primary:
      "border border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:-translate-y-px hover:bg-primary/90 hover:shadow-md",
    accent:
      "border border-accent bg-accent text-accent-foreground shadow-sm shadow-accent/20 hover:-translate-y-px hover:brightness-95 hover:shadow-md",
    ghost:
      "border border-border bg-background text-foreground shadow-sm hover:-translate-y-px hover:border-primary/40 hover:bg-primary-soft hover:text-primary hover:shadow-md",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 active:translate-y-px disabled:opacity-60 sm:w-auto ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-ring focus:ring-4 focus:ring-ring/10";

export function PasswordInput({
  className = inputClass,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function ResponsiveTable({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  return (
    <>
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          {desktop}
        </div>
      </div>
      <div className="space-y-3 md:hidden">{mobile}</div>
    </>
  );
}
