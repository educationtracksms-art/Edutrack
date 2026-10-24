import { FileWarning } from "lucide-react";

/**
 * SubscriptionExpiredBlock
 *
 * Full-screen, non-dismissible blocking message shown to non-admin school users
 * when their school's subscription has expired.
 *
 * Renders the exact required message:
 *   Hello, [name];
 *   The [schoolName] subscription has expired.
 *   Please contact your school administrator for subscription.
 */
export function SubscriptionExpiredBlock({
  userName,
  schoolName,
}: {
  userName?: string | null;
  schoolName?: string | null;
} = {}) {
  const name = userName?.trim() || "there";
  const school = schoolName?.trim() || "your school";

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center sm:px-6"
      role="alert"
      aria-live="assertive"
      aria-modal="true"
      aria-label="Subscription expired"
    >
      <div className="w-full max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 p-8 shadow-lg sm:p-10">
        <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <FileWarning className="h-7 w-7 text-destructive" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
          Subscription Expired
        </p>

        <div className="mt-5 rounded-xl border border-border bg-background p-5 text-left text-sm leading-relaxed text-foreground">
          <p className="font-semibold">Hello, {name};</p>
          <p className="mt-2">The {school} subscription has expired.</p>
          <p className="mt-2">Please contact your school administrator for subscription.</p>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          This screen cannot be dismissed. All dashboards are locked until the subscription is renewed.
        </p>
      </div>
    </div>
  );
}

