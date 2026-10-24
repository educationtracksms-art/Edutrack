import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Calendar, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { currentUserQueryOptions, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader, Panel, Pill } from "@/components/ui-kit";
import { setAccessNotice } from "@/lib/access-notice";
import {
  createSchoolSubscription,
  cancelSchoolSubscription,
} from "@/lib/subscription.functions";
import { SubscriptionExpiredBlock } from "@/components/subscription/SubscriptionExpiredBlock";
import { checkSubscriptionExpired } from "@/lib/subscription-guard";

export const Route = createFileRoute("/_authenticated/subscription")({
  beforeLoad: async ({ context }) => {
    // Only the School Admin may open the Subscription page. Super Admin keeps
    // full platform access; every other school user gets redirected with 403-style notice.
    const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
    if (!currentUser) throw redirect({ to: "/auth" });
    const allowed =
      currentUser.roles.includes("school_admin") || currentUser.isSuperAdmin;
    if (!allowed) {
      setAccessNotice(
        "Only the School Administrator can access the Subscription page.",
      );
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Subscription · EduTrack" },
      { name: "description", content: "View and manage your school's EduTrack subscription." },
    ],
  }),
  component: SubscriptionPage,
});

type Plan = {
  id: string;
  name: string;
  price: number;
  duration_value: number;
  duration_unit: string;
  duration_days: number;
  description: string | null;
  is_active: boolean;
  is_platform_only: boolean;
  display_order: number;
  created_at: string;
};

type ActiveSubscription = {
  id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  payment_reference: string | null;
  plan: Plan;
};

function money(amount: number): string {
  return `UGX ${Number(amount).toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" });
}

function durationLabel(value: number, unit: string): string {
  const labels: Record<string, string> = { days: "Days", weeks: "Weeks", months: "Months", years: "Years" };
  if (value === 1) return `1 ${unit.endsWith("s") ? unit.slice(0, -1) : unit}`;
  return `${value} ${labels[unit] ?? unit}`;
}

function statusBadge(status: string): { tone: "success" | "warning" | "muted" | "danger"; label: string } {
  const map: Record<string, { tone: "success" | "warning" | "muted" | "danger"; label: string }> = {
    active: { tone: "success", label: "Active" },
    trial: { tone: "warning", label: "Trial" },
    past_due: { tone: "warning", label: "Past Due" },
    pending: { tone: "muted", label: "Pending Confirmation" },
    confirmed: { tone: "muted", label: "Confirmed" },
    expired: { tone: "danger", label: "Expired" },
    cancelled: { tone: "danger", label: "Cancelled" },
    not_configured: { tone: "muted", label: "Not Configured" },
  };
  return map[status] ?? { tone: "muted" as const, label: status };
}

function SubscriptionPage() {
  const { data: me, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const schoolId = (me?.profile as { school_id?: string } | null)?.school_id ?? null;
  const canView = hasAny(me?.roles, ["school_admin", "super_admin"]);
  const isSchoolAdmin = me?.roles.includes("school_admin");
  const isLoading = userLoading || !me;

  const { data: expiredCheck } = useQuery({
    queryKey: ["subscription-expired-check", schoolId],
    enabled: !!schoolId && canView && !isSchoolAdmin,
    staleTime: 60_000,
    queryFn: async () => (await checkSubscriptionExpired({ queryClient })) as boolean,
  });

  const showBlockingScreen = !isSchoolAdmin && expiredCheck === true;

  const { data: currentSub } = useQuery({
    queryKey: ["active-subscription", schoolId],
    enabled: !!schoolId && canView,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subscriptions")
        .select(`id, plan_id, status, starts_at, ends_at, payment_reference,
          subscription_plans (id, name, price, duration_value, duration_unit, duration_days, description, is_active, is_platform_only)`)
        .eq("school_id", schoolId!)
        .in("status", ["trial", "active", "past_due", "pending", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        plan_id: string;
        status: string;
        starts_at: string;
        ends_at: string | null;
        payment_reference: string | null;
        subscription_plans: Plan;
      };
      return {
        id: row.id,
        plan_id: row.plan_id,
        status: row.status,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        payment_reference: row.payment_reference,
        plan: row.subscription_plans,
      } as ActiveSubscription;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans-list", schoolId],
    enabled: !!schoolId && canView,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price, duration_value, duration_unit, duration_days, description, is_active, is_platform_only, display_order, created_at")
        .eq("is_active", true)
        .eq("is_platform_only", false)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Plan[];
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: (planId: string) => createSchoolSubscription({ data: { planId } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Subscription created", {
          description: `Reference: ${result.subscription.payment_reference}. Complete payment to activate.`,
        });
        queryClient.invalidateQueries({ queryKey: ["active-subscription", schoolId] });
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("already has an active")) toast.error(error.message);
      else toast.error(error.message || "Could not create subscription");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (subId: string) =>
      cancelSchoolSubscription({ data: { subscriptionId: subId } }),
    onSuccess: () => {
      toast.success("Subscription cancelled");
      queryClient.invalidateQueries({ queryKey: ["active-subscription", schoolId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showBlockingScreen) return <SubscriptionExpiredBlock />;

  if (!schoolId) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Panel title="Subscription">
          <p className="text-sm text-muted-foreground">Not linked to a school. Contact the Super Admin.</p>
        </Panel>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Panel title="Subscription">
          <p className="text-sm text-muted-foreground">
            Only School Admins, Head Teachers, and DOS can access this page.
          </p>
        </Panel>
      </div>
    );
  }

  const sub = currentSub;
  const status = sub?.status ?? "not_configured";
  const subBadge = statusBadge(status);
  const hasOpenSub = ["trial", "active", "past_due", "pending", "confirmed"].includes(status);
  const isPending = status === "pending";
  const blockNewSub = hasOpenSub && !isPending;
  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Subscription"
        description="Manage your school's EduTrack subscription plan and payment."
      />

      {sub && (
        <Panel title={`Current Subscription — ${sub.plan.name}`} className="mb-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-3">
              <Pill tone={subBadge.tone}>{subBadge.label}</Pill>
              {isPending && (
                <span className="text-xs text-muted-foreground">
                  Awaiting Super Admin payment confirmation.
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Start: {formatDate(sub.starts_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>End: {formatDate(sub.ends_at)}</span>
              </div>
              {sub.payment_reference && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-mono text-xs">{sub.payment_reference}</span>
                </div>
              )}
            </div>
            <div className="text-sm font-semibold">
              {money(sub.plan.price)} / {durationLabel(sub.plan.duration_value, sub.plan.duration_unit)}
            </div>
          </div>

          {sub.plan.description && (
            <p className="mt-4 text-sm text-muted-foreground">{sub.plan.description}</p>
          )}

          {isPending && (
            <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/5 p-5 text-sm">
              <p className="font-medium">
                Your payment is being reviewed. Please wait for system confirmation. You will be
                notified once your subscription is activated.
              </p>
              <p className="mt-2 text-muted-foreground">Reference: {sub.payment_reference}</p>
            </div>
          )}

          {isPending && isSchoolAdmin && (
            <button
              type="button"
              onClick={() => cancelMutation.mutate(sub.id)}
              disabled={cancelMutation.isPending}
              className="mt-4 text-sm text-destructive hover:underline disabled:opacity-40"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel this subscription"}
            </button>
          )}
        </Panel>
      )}



      {!hasOpenSub && plans.length > 0 && (
        <Panel title="Available Plans" className="mb-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const startDate = sub?.starts_at ?? new Date().toISOString().slice(0, 10);
              const computedEnd = new Date(startDate + "T00:00:00");
              computedEnd.setDate(computedEnd.getDate() + Number(plan.duration_days));
              const endDateStr = computedEnd.toISOString().slice(0, 10);
              const isSelected = sub?.plan_id === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-5 shadow-[var(--shadow-card)] transition-colors ${
                    isSelected ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{money(plan.price)}</p>
                    </div>
                    <Pill tone={plan.is_platform_only ? "muted" : "success"}>
                      {plan.is_platform_only ? "Platform" : "Available"}
                    </Pill>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {durationLabel(plan.duration_value, plan.duration_unit)} — {plan.duration_days} days
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-medium">{formatDate(startDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">End Date</span>
                      <span className="font-medium">{formatDate(endDateStr)}</span>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{plan.description}</p>
                  )}

                  <div className="mt-5 flex items-center gap-3">
                    {isSelected && isPending ? (
                      <Pill tone="muted">Subscribed — Pending</Pill>
                    ) : isSelected && !isPending ? (
                      <Pill tone="success">Currently Active</Pill>
                    ) : blockNewSub ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 rounded-lg bg-primary/50 px-4 py-2 text-sm text-primary/60 cursor-not-allowed"
                      >
                        Cancel active sub first
                      </button>
                    ) : subscribeMutation.isPending ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 rounded-lg bg-primary/50 px-4 py-2 text-sm text-primary/60 cursor-not-allowed"
                      >
                        Subscribing...
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => subscribeMutation.mutate(plan.id)}
                        className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Subscribe
                      </button>
                    )}
                  </div>

                  {blockNewSub && (
                    <p className="mt-2 text-xs text-destructive">
                      This school already has an active subscription. Cancel it first.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}


      {plans.length === 0 && (
        <Panel title="Available Plans">
          <p className="text-sm text-muted-foreground">
            No active plans available. Contact the Super Admin.
          </p>
        </Panel>
      )}

      {isPending && sub && (
        <Panel title="Payment Instructions" className="mt-6 border-accent/20 bg-accent/5">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-accent" />
            <div>
              <h3 className="text-base font-bold">Complete Your Payment</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                To complete your subscription, please pay using any of the numbers below:
              </p>

              <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">MTN</span>
                  <span className="font-mono text-sm">0760228289</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Airtel</span>
                  <span className="font-mono text-sm">0702188557</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-primary/10 bg-primary-soft p-4 text-sm">
                <p>
                  <strong>Amount:</strong> {money(sub.plan.price)}
                  <br />
                  <strong>Duration:</strong>{" "}
                  {durationLabel(sub.plan.duration_value, sub.plan.duration_unit)}
                  <br />
                  <strong>Reference:</strong> {sub.payment_reference}
                </p>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                After payment, please wait for system confirmation. Your subscription will be activated
                once payment is confirmed by the system administrator.
              </p>

              <p className="mt-3 text-sm text-muted-foreground">
                Your payment is being reviewed. Please wait for system confirmation. You will be
                notified once your subscription is activated.
              </p>
            </div>
          </div>
        </Panel>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Subscription management is restricted to School Administrators. Payment records are managed by
        the EduTrack Super Admin. Contact them to confirm your payment.
      </p>
    </div>
  );
}

