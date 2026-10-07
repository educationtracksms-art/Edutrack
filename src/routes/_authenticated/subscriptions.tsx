import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, CheckCircle, XCircle, Eye, Edit2, Plus, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader, Panel, Pill } from "@/components/ui-kit";
import {
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getSubscriptionDetails,
  confirmPayment,
  revokeSubscription,
  durationToDays,
} from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions · EduTrack" },
      {
        name: "description",
        content: "Manage school subscription plans, billing and payments.",
      },
    ],
  }),
  component: SubscriptionsPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanRow = {
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

type SubRow = {
  id: string;
  school_id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  payment_reference: string | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  schools: { name: string; code: string; status: string } | null;
  subscription_plans: {
    id: string;
    name: string;
    price: number;
    duration_value: number;
    duration_unit: string;
    duration_days: number;
    is_active: boolean;
    description: string | null;
  } | null;
};

type DetailRow = {
  id: string;
  school_id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  payment_reference: string | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  created_at: string;
  schools: { id: string; name: string; code: string } | null;
  subscription_plans: {
    id: string;
    name: string;
    price: number;
    duration_value: number;
    duration_unit: string;
  } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function money(amount: number | null | undefined): string {
  return amount != null ? `UGX ${Number(amount).toLocaleString()}` : "—";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  return d.toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

function durationLabel(value: number | undefined, unit: string | undefined): string {
  if (value == null || !unit) return "—";
  const labels: Record<string, string> = { days: "Days", weeks: "Weeks", months: "Months", years: "Years" };
  const single = value === 1 ? unit.slice(0, -1) : labels[unit] ?? unit;
  return `${value} ${single}`;
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
  };
  return map[status] ?? { tone: "muted" as const, label: status };
}

// ─── Page component ──────────────────────────────────────────────────────────

function SubscriptionsPage() {
  const { data: me, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const canView = hasAny(me?.roles, ["super_admin"]);
  const isLoading = userLoading || !me;

  // Dialog state
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [confirmingSub, setConfirmingSub] = useState<SubRow | null>(null);
  const [revokingSub, setRevokingSub] = useState<SubRow | null>(null);
  const [viewingSubId, setViewingSubId] = useState<string | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["super-admin-plans"],
    enabled: canView,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanRow[];
    },
  });

  const { data: subs = [], isLoading: subsLoading } = useQuery({
    queryKey: ["super-admin-subscriptions"],
    enabled: canView,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subscriptions")
        .select(`
          id, school_id, plan_id, status, starts_at, ends_at,
          payment_reference, payment_confirmed_by, payment_confirmed_at,
          created_at, updated_at,
          schools (name, code, status),
          subscription_plans (id, name, price, duration_value, duration_unit, duration_days, is_active, description)
        `)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as SubRow[];
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: (data: {
      name: string;
      price: number;
      durationValue: number;
      durationUnit: "days" | "weeks" | "months" | "years";
      description?: string;
    }) => createSubscriptionPlan({ data }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Plan created", {
          description: `${result.plan.name} — ${money(result.plan.price)}/${durationLabel(result.plan.duration_value, result.plan.duration_unit)}`,
        });
        setCreatingPlan(false);
        queryClient.invalidateQueries({ queryKey: ["super-admin-plans"] });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePlanMutation = useMutation({
    mutationFn: (data: {
      planId: string;
      name?: string;
      price?: number;
      durationValue?: number;
      durationUnit?: "days" | "weeks" | "months" | "years";
      description?: string;
      isActive?: boolean;
    }) => updateSubscriptionPlan({ data }),
    onSuccess: (result) => {
      if (result.ok && result.plan) {
        toast.success("Plan updated", { description: `${result.plan.name} has been updated.` });
        setEditingPlan(null);
        queryClient.invalidateQueries({ queryKey: ["super-admin-plans"] });
        queryClient.invalidateQueries({ queryKey: ["super-admin-subscriptions"] });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmMutation = useMutation({
    mutationFn: (data: {
      subscriptionId: string;
      paymentMethod: "mtn" | "airtel" | "bank" | "other";
    }) => confirmPayment({ data }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Payment confirmed", {
          description: `Subscription activated until ${result.endDate}. Reference: ${result.paymentReference}`,
        });
        setConfirmingSub(null);
        queryClient.invalidateQueries({ queryKey: ["super-admin-subscriptions"] });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (data: { subscriptionId: string; reason?: string }) => revokeSubscription({ data }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Subscription revoked");
        setRevokingSub(null);
        queryClient.invalidateQueries({ queryKey: ["super-admin-subscriptions"] });
      }
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

  if (!canView) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
                <Panel title="Subscriptions">
          <p className="text-sm text-muted-foreground">Only the Super Admin can access this page.</p>
        </Panel>
      </div>
    );
    }

  const sortedSubs = [...subs].sort((a, b) => {
    const order: Record<string, number> = { pending: 0, active: 1, trial: 2, past_due: 3, confirmed: 4, expired: 5, cancelled: 6 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  const pendingCount = subs.filter((s) => s.status === "pending").length;
  const canConfirm = canView;

  return (
    <div>
      <PageHeader
        eyebrow="Platform Administration"
        title="Subscriptions"
        description="Create plans, review pending payments, and activate school subscriptions. Only the Super Admin can manage this page."
      />

      {pendingCount > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold">
              {pendingCount} pending payment{pendingCount > 1 ? "s" : ""} awaiting confirmation
            </p>
            <p className="text-xs text-muted-foreground">
              Verify the MTN/Airtel payment, then confirm to activate the school subscription.
            </p>
          </div>
        </div>
      )}

      {/* ── Subscription Plans ─────────────────────────────────────────────── */}
      <Panel title="Subscription Plans (Super Admin controlled)" className="mb-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Only the Super Admin can create plans and define each plan's duration (value + unit).
          </p>
          <button
            type="button"
            onClick={() => setCreatingPlan(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Plan
          </button>
        </div>

        {plansLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No plans yet. Create the first plan to let schools subscribe.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border p-5 shadow-[var(--shadow-card)] transition-all ${
                  plan.is_active ? "border-border hover:border-primary/25" : "border-border/60 bg-muted/30 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      {!plan.is_active && <Pill tone="danger">Inactive</Pill>}
                      {plan.is_platform_only && <Pill tone="muted">Platform</Pill>}
                    </div>
                    <p className="mt-1 text-xl font-bold">{money(plan.price)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {durationLabel(plan.duration_value, plan.duration_unit)} · {plan.duration_days} days
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Edit plan"
                    onClick={() => setEditingPlan(plan)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {plan.description && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {plan.description}
                  </p>
                )}

                <p className="mt-4 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  Effective: {durationToDays(plan.duration_value, plan.duration_unit)} days
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 rounded-xl border border-primary/10 bg-primary-soft px-4 py-3 text-xs text-muted-foreground">
          Editing a plan's duration affects only new subscriptions. Existing subscriptions keep the
          duration that was active when they were created. Deactivated plans remain valid for
          already-subscribed schools until they expire.
        </p>
            </Panel>

      {/* ── All School Subscriptions ───────────────────────────────────────── */}
      <Panel title="All School Subscriptions">
        {subsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedSubs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No subscriptions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">School</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Start</th>
                  <th className="pb-3 font-medium">End</th>
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedSubs.map((sub) => {
                  const badge = statusBadge(sub.status);
                  const canConfirm = sub.status === "pending";

                  return (
                    <tr key={sub.id}>
                      <td className="py-3">
                        <p className="font-medium">{sub.schools?.name ?? "Unknown School"}</p>
                        <p className="text-xs text-muted-foreground">{sub.schools?.code}</p>
                      </td>
                      <td className="py-3">
                        <p>{sub.subscription_plans?.name ?? "Unknown Plan"}</p>
                        <p className="text-xs text-muted-foreground">
                          {money(sub.subscription_plans?.price)}
                        </p>
                      </td>
                      <td className="py-3">
                        <Pill tone={badge.tone}>{badge.label}</Pill>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {durationLabel(
                          sub.subscription_plans?.duration_value,
                          sub.subscription_plans?.duration_unit,
                        )}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">{formatDate(sub.starts_at)}</td>
                      <td className="py-3 text-xs text-muted-foreground">{formatDate(sub.ends_at)}</td>
                      <td className="py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {sub.payment_reference ?? "—"}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View details"
                            onClick={() => setViewingSubId(sub.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canConfirm && (
                            <button
                              type="button"
                              title="Confirm payment and activate"
                              onClick={() => setConfirmingSub(sub)}
                              className="rounded-lg p-2 text-success hover:bg-success/10"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {sub.status !== "cancelled" && (
                            <button
                              type="button"
                              title="Revoke subscription"
                              onClick={() => setRevokingSub(sub)}
                              className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>


      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {(creatingPlan || editingPlan) && (
        <PlanFormDialog
          key={editingPlan?.id ?? "new"}
          plan={editingPlan}
          onClose={() => {
            setCreatingPlan(false);
            setEditingPlan(null);
          }}
          onSubmit={(data) => {
            if (editingPlan) {
              updatePlanMutation.mutate({ planId: editingPlan.id, ...data });
            } else {
              createPlanMutation.mutate(data);
            }
          }}
          isPending={createPlanMutation.isPending || updatePlanMutation.isPending}
        />
      )}

      {confirmingSub && (
        <ConfirmPaymentDialog
          subscription={confirmingSub}
          onClose={() => setConfirmingSub(null)}
          onConfirm={(paymentMethod) =>
            confirmMutation.mutate({ subscriptionId: confirmingSub.id, paymentMethod })
          }
          isPending={confirmMutation.isPending}
        />
      )}

      {revokingSub && (
        <RevokeDialog
          subscription={revokingSub}
          onClose={() => setRevokingSub(null)}
          onConfirm={(reason) => revokeMutation.mutate({ subscriptionId: revokingSub.id, reason })}
          isPending={revokeMutation.isPending}
        />
      )}

      {viewingSubId && (
        <SubscriptionDetailDialog
          subscriptionId={viewingSubId}
          onClose={() => setViewingSubId(null)}
        />
      )}
    </div>
  );
}

// ─── Dialog: Create / Edit plan ───────────────────────────────────────────────

type PlanFormValues = {
  name: string;
  price: number;
  durationValue: number;
  durationUnit: "days" | "weeks" | "months" | "years";
  description?: string;
  isActive?: boolean;
};

function PlanFormDialog({
  plan,
  onClose,
  onSubmit,
  isPending,
}: {
  plan: PlanRow | null;
  onClose: () => void;
  onSubmit: (data: PlanFormValues) => void;
  isPending: boolean;
}) {
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan?.price ?? 0);
  const [durationValue, setDurationValue] = useState(plan?.duration_value ?? 1);
  const [durationUnit, setDurationUnit] = useState<"days" | "weeks" | "months" | "years">(
    (plan?.duration_unit as "days" | "weeks" | "months" | "years") ?? "months",
  );
  const [description, setDescription] = useState(plan?.description ?? "");
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);

  const effectiveDays = durationToDays(durationValue, durationUnit);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Plan name is required");
    if (durationValue < 1) return toast.error("Duration value must be at least 1");
    onSubmit({
      name: name.trim(),
      price,
      durationValue,
      durationUnit,
      description: description.trim() || undefined,
      isActive: isEdit ? isActive : undefined,
    });
  }


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold">{isEdit ? "Edit Plan" : "Create Plan"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit
            ? "Duration changes affect only new subscriptions. Existing subscriptions keep their original expiry."
            : "Define the plan price and duration. School admins can only subscribe to plans you create here."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <div>
            <label className="block text-sm font-medium">Plan Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2"
              placeholder="e.g. Basic, Standard, Premium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Price (UGX)</label>
              <input
                type="number"
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                placeholder="50000"
                min={0}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Duration Value</label>
              <input
                type="number"
                value={durationValue}
                onChange={(event) => setDurationValue(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                placeholder="1"
                min={1}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Duration Unit</label>
            <select
              value={durationUnit}
              onChange={(event) =>
                setDurationUnit(event.target.value as "days" | "weeks" | "months" | "years")
              }
              className="mt-1 w-full rounded-lg border border-border bg-background p-2"
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Description (optional)</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background p-2"
              rows={3}
              placeholder="Features included in this plan..."
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Plan is active (schools can subscribe)
            </label>
          )}

          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Duration preview</p>
            <p className="mt-1">
              {durationValue} {durationUnit} = {effectiveDays} days. A subscription starting today would
              end on{" "}
              {new Date(Date.now() + effectiveDays * 86_400_000).toLocaleDateString("en-UG", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              .
            </p>
          </div>

          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Dialog: Confirm payment (Super Admin only) ───────────────────────────────

function ConfirmPaymentDialog({
  subscription,
  onClose,
  onConfirm,
  isPending,
}: {
  subscription: SubRow;
  onClose: () => void;
  onConfirm: (paymentMethod: "mtn" | "airtel" | "bank" | "other") => void;
  isPending: boolean;
}) {
  const [method, setMethod] = useState<"mtn" | "airtel" | "bank" | "other">("mtn");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold">Confirm Payment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify that the school has paid, then confirm to activate their subscription. Only the Super
          Admin can perform this action.
        </p>

        <div className="mt-5 space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">School</span>
            <span className="font-medium">{subscription.schools?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{subscription.subscription_plans?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{money(subscription.subscription_plans?.price)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">
              {durationLabel(
                subscription.subscription_plans?.duration_value,
                subscription.subscription_plans?.duration_unit,
              )}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-mono text-xs">{subscription.payment_reference ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Status</span>
            <Pill tone={statusBadge(subscription.status).tone}>
              {statusBadge(subscription.status).label}
            </Pill>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Payment Method</p>
          <div className="grid grid-cols-2 gap-3">
            {(["mtn", "airtel", "bank", "other"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMethod(item)}
                className={`rounded-lg border p-3 text-sm transition-all ${
                  method === item
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border hover:border-primary/20"
                }`}
              >
                {item === "mtn"
                  ? "MTN Mobile Money"
                  : item === "airtel"
                    ? "Airtel Money"
                    : item === "bank"
                      ? "Bank Transfer"
                      : "Other"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(method)}
            disabled={isPending}
            className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Confirming..." : "Confirm & Activate"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Dialog: Revoke subscription ──────────────────────────────────────────────

function RevokeDialog({
  subscription,
  onClose,
  onConfirm,
  isPending,
}: {
  subscription: SubRow;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold">Revoke Subscription</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This cancels the subscription immediately. The school loses access until a new subscription is
          activated. Only the Super Admin can revoke any subscription.
        </p>

        <div className="mt-5 space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">School</span>
            <span className="font-medium">{subscription.schools?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{subscription.subscription_plans?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Current Status</span>
            <Pill tone={statusBadge(subscription.status).tone}>
              {statusBadge(subscription.status).label}
            </Pill>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full resize-none rounded-lg border border-border bg-background p-2"
            rows={2}
            placeholder="Why is this subscription being revoked?"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={isPending}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Revoking..." : "Revoke Subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Dialog: Subscription details ─────────────────────────────────────────────

function SubscriptionDetailDialog({
  subscriptionId,
  onClose,
}: {
  subscriptionId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription-detail", subscriptionId],
    queryFn: async () => {
      const result = await getSubscriptionDetails({ data: { subscriptionId } });
      return result.subscription as unknown as DetailRow | null;
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold">Subscription Details</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="mt-4 text-sm text-muted-foreground">Subscription not found.</p>
        ) : (
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">School</span>
              <span className="font-medium">{data.schools?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">School Code</span>
              <span>{data.schools?.code ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{data.subscription_plans?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <Pill tone={statusBadge(data.status).tone}>{statusBadge(data.status).label}</Pill>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <span>{money(data.subscription_plans?.price)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Duration</span>
              <span>
                {durationLabel(
                  data.subscription_plans?.duration_value,
                  data.subscription_plans?.duration_unit,
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Start Date</span>
              <span>{formatDate(data.starts_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">End Date</span>
              <span>{formatDate(data.ends_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Payment Reference</span>
              <span className="font-mono text-xs">{data.payment_reference ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Confirmed By</span>
              <span>{data.payment_confirmed_by ? "Super Admin" : "Not confirmed"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Confirmed At</span>
              <span>{formatDate(data.payment_confirmed_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(data.created_at)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

