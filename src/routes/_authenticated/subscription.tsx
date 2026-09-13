import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CreditCard, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader, Panel, Pill, Stat } from "@/components/ui-kit";
import { changeOwnSchoolSubscription } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription · EduTrack" },
      {
        name: "description",
        content: "View your school's EduTrack subscription and payment history.",
      },
    ],
  }),
  component: SubscriptionPage,
});

type Subscription = {
  id: string;
  plan_id: string;
  status: "trial" | "active" | "past_due" | "expired" | "cancelled";
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  auto_renew: boolean;
  created_at: string;
};
type Plan = {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  description: string | null;
  is_platform_only?: boolean;
};
type Payment = {
  id: string;
  amount: number;
  currency: string;
  payment_date: string;
  method: string;
  reference: string | null;
  status: string;
};

function actualStatus(subscription: Subscription | undefined) {
  if (!subscription) return "not_configured";
  const today = new Date().toISOString().slice(0, 10);
  if (
    subscription.ends_at &&
    subscription.ends_at < today &&
    ["trial", "active", "past_due"].includes(subscription.status)
  )
    return "expired";
  return subscription.status;
}

function tone(status: string): "success" | "warning" | "muted" | "danger" {
  if (status === "active") return "success";
  if (status === "trial" || status === "past_due") return "warning";
  if (status === "expired" || status === "cancelled") return "danger";
  return "muted";
}

function label(status: string) {
  return status === "not_configured" ? "Not configured" : status.replaceAll("_", " ");
}

function money(amount: number, currency = "UGX") {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function SubscriptionPage() {
  const { data: me, isLoading: userLoading } = useCurrentUser();
  const schoolId = (me?.profile as { school_id?: string } | null)?.school_id ?? null;
  const canView = hasAny(me?.roles, ["school_admin", "head_teacher", "dos"]);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["school-subscriptions", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subscriptions")
        .select("id,plan_id,status,starts_at,ends_at,notes,auto_renew,created_at")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Subscription[];
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id,name,price,billing_cycle,description,is_platform_only");
      if (error) throw new Error(error.message);
      return (data ?? []) as Plan[];
    },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["school-payments", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_payments")
        .select("id,amount,currency,payment_date,method,reference,status")
        .eq("school_id", schoolId!)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Payment[];
    },
  });
  const { data: ultimateSubscription = false } = useQuery({
    queryKey: ["current-school-ultimate", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "current_school_has_ultimate_subscription",
      );
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });

  const subscription = useMemo(
    () =>
      subscriptions.find((item) => ["trial", "active", "past_due"].includes(item.status)) ??
      subscriptions[0],
    [subscriptions],
  );
  const status = actualStatus(subscription);
  const plan = plans.find((item) => item.id === subscription?.plan_id);
  const confirmedTotal = payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Subscription["status"]>("active");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);
  const changeMutation = useMutation({
    mutationFn: () =>
      changeOwnSchoolSubscription({
        data: {
          planId: selectedPlan,
          status: selectedStatus,
          startsAt,
          endsAt: endsAt || undefined,
          autoRenew,
        },
      }),
    onSuccess: () => {
      toast.success("Subscription updated");
      queryClient.invalidateQueries({ queryKey: ["school-subscriptions", schoolId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const isUltimate = ultimateSubscription || plan?.is_platform_only === true;

  if (userLoading || !me || (canView && isLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading subscription details…
      </div>
    );
  }
  if (!canView) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Subscription details are restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the School Administrator, Head Teacher and Director of Studies can view billing for
          this school.
        </p>
      </div>
    );
  }
  if (!schoolId) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">No school linked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the platform administrator to link your account to a school.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="School subscription"
        eyebrow="Billing"
        description={
          isUltimate
            ? "Your Ultimate subscription is managed by the EduTrack Super Admin."
            : "Manage your school subscription plan and status."
        }
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary-soft px-3 py-2 text-xs text-primary">
            <CreditCard className="h-4 w-4" /> Platform managed
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Current status"
          value={label(status)}
          hint={subscription?.ends_at ? `Until ${subscription.ends_at}` : "No end date set"}
        />
        <Stat
          label="Plan"
          value={plan?.name ?? "—"}
          hint={plan ? `${money(plan.price)}/${plan.billing_cycle}` : "Contact platform admin"}
        />
        <Stat label="Payments recorded" value={payments.length} />
        <Stat label="Confirmed total" value={money(confirmedTotal)} />
      </div>

      {!subscription && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">No subscription has been assigned yet</p>
            <p className="mt-1 text-muted-foreground">
              Ask your EduTrack Super Admin to select a plan and activate your school.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Subscription details">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <Pill tone={tone(status)}>{label(status)}</Pill>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{plan?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Billing cycle</span>
              <span className="font-medium capitalize">{plan?.billing_cycle ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Starts</span>
              <span className="font-medium">{subscription?.starts_at ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Ends</span>
              <span className="font-medium">{subscription?.ends_at ?? "No end date"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Auto-renew</span>
              <span className="font-medium">
                {subscription?.auto_renew ? "Enabled" : "Not enabled"}
              </span>
            </div>
            {subscription?.notes && (
              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground">Note from platform admin</p>
                <p className="mt-1 whitespace-pre-wrap">{subscription.notes}</p>
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Payment history">
          {payments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-border">
                      <td className="py-3">{payment.payment_date}</td>
                      <td className="font-medium">{money(payment.amount, payment.currency)}</td>
                      <td className="capitalize">{payment.method.replaceAll("_", " ")}</td>
                      <td>
                        <Pill
                          tone={
                            payment.status === "confirmed"
                              ? "success"
                              : payment.status === "pending"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {payment.status}
                        </Pill>
                      </td>
                      <td className="text-muted-foreground">{payment.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No payment records are available yet.
            </div>
          )}
        </Panel>
      </div>
      {!isUltimate && (
        <Panel title="Change subscription" className="mt-4">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedPlan) return toast.error("Choose a plan");
              changeMutation.mutate();
            }}
          >
            <label className="text-sm">
              Plan
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                value={selectedPlan}
                onChange={(event) => setSelectedPlan(event.target.value)}
              >
                <option value="">Select plan</option>
                {plans
                  .filter((item) => !item.is_platform_only)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as Subscription["status"])
                }
              >
                {["trial", "active", "past_due", "expired", "cancelled"].map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Starts
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Ends
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(event) => setAutoRenew(event.target.checked)}
                />{" "}
                Auto-renew
              </label>
              <button
                type="submit"
                disabled={changeMutation.isPending}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {changeMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Panel>
      )}
      <p className="mt-4 rounded-2xl border border-primary/10 bg-primary-soft px-4 py-3 text-xs text-muted-foreground">
        {isUltimate
          ? "Ultimate is a lifetime plan and cannot be changed by school users. Contact the EduTrack Super Admin for any platform-level change."
          : "School billing roles can change the plan and subscription status here. Payment records remain managed by the EduTrack Super Admin."}
      </p>
    </div>
  );
}
