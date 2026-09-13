import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  createSchoolWithAdmin,
  createSubscriptionPlan,
  manageSchoolSubscription,
  recordSchoolPayment,
  setSchoolStatus,
  setSubscriptionPlanStatus,
  updateSchoolPaymentStatus,
  updateSubscriptionPlan,
} from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import {
  Btn,
  Field,
  PageHeader,
  Panel,
  Pill,
  ResponsiveTable,
  Stat,
  inputClass,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({
    meta: [
      { title: "Schools · EduTrack" },
      {
        name: "description",
        content: "Create, suspend and manage subscriptions for every school tenant.",
      },
    ],
  }),
  component: SchoolsPage,
});

type SubscriptionStatus =
  "trial" | "active" | "past_due" | "expired" | "cancelled" | "not_configured";
type Plan = {
  id: string;
  name: string;
  price: number;
  billing_cycle: "monthly" | "termly" | "annual";
  display_order: number;
  description: string | null;
  is_active: boolean;
  is_platform_only: boolean;
};
type Subscription = {
  id: string;
  school_id: string;
  plan_id: string;
  status: Exclude<SubscriptionStatus, "not_configured">;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  auto_renew: boolean;
  created_at: string;
};
type School = {
  id: string;
  name: string;
  code: string;
  status: "active" | "suspended";
  subscription_plan: string;
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

const today = () => new Date().toISOString().slice(0, 10);

function effectiveStatus(subscription: Subscription | undefined): SubscriptionStatus {
  if (!subscription) return "not_configured";
  if (
    subscription.ends_at &&
    subscription.ends_at < today() &&
    ["trial", "active", "past_due"].includes(subscription.status)
  ) {
    return "expired";
  }
  return subscription.status;
}

function statusTone(status: SubscriptionStatus): "success" | "warning" | "muted" | "danger" {
  if (status === "active") return "success";
  if (status === "trial" || status === "past_due") return "warning";
  if (status === "expired" || status === "cancelled") return "danger";
  return "muted";
}

function statusLabel(status: SubscriptionStatus) {
  return status === "not_configured" ? "Not configured" : status.replaceAll("_", " ");
}

function formatMoney(amount: number, currency = "UGX") {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

export function SchoolsPage({
  title = "Schools & billing",
  description = "Create and monitor school tenants, plans, subscriptions and payment records from one platform control centre.",
}: {
  title?: string;
  description?: string;
}) {
  const queryClient = useQueryClient();
  const createSchool = useServerFn(createSchoolWithAdmin);
  const changeStatus = useServerFn(setSchoolStatus);
  const changeSubscription = useServerFn(manageSchoolSubscription);
  const recordPayment = useServerFn(recordSchoolPayment);
  const changePaymentStatus = useServerFn(updateSchoolPaymentStatus);
  const createPlan = useServerFn(createSubscriptionPlan);
  const updatePlan = useServerFn(updateSubscriptionPlan);
  const changePlanStatus = useServerFn(setSubscriptionPlanStatus);

  const [billingSchoolId, setBillingSchoolId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    email: "",
    phone: "",
    adminName: "",
    adminEmail: "",
  });
  const [billing, setBilling] = useState({
    planId: "",
    status: "active" as Exclude<SubscriptionStatus, "not_configured">,
    startsAt: today(),
    endsAt: "",
    autoRenew: false,
    notes: "",
    amount: "",
    paymentDate: today(),
    method: "mobile_money",
    paymentStatus: "confirmed",
    reference: "",
  });
  const [planForm, setPlanForm] = useState({
    name: "",
    price: "",
    billingCycle: "monthly" as Plan["billing_cycle"],
    description: "",
  });

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id,name,code,status,subscription_plan")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as School[];
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id,name,price,billing_cycle,display_order,description,is_active,is_platform_only")
        .order("display_order", { ascending: true })
        .order("price", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Plan[];
    },
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["school-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subscriptions")
        .select("id,school_id,plan_id,status,starts_at,ends_at,notes,auto_renew,created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Subscription[];
    },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["school-payments", billingSchoolId],
    enabled: !!billingSchoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_payments")
        .select("id,amount,currency,payment_date,method,reference,status")
        .eq("school_id", billingSchoolId!)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw new Error(error.message);
      return (data ?? []) as Payment[];
    },
  });

  const currentBySchool = useMemo(() => {
    const result = new Map<string, Subscription>();
    for (const subscription of subscriptions) {
      const existing = result.get(subscription.school_id);
      if (!existing || subscription.created_at > existing.created_at) {
        result.set(subscription.school_id, subscription);
      }
    }
    return result;
  }, [subscriptions]);
  const selectedSchool = schools.find((school) => school.id === billingSchoolId);
  const selectedSubscription = billingSchoolId ? currentBySchool.get(billingSchoolId) : undefined;
  const selectedPlan = plans.find((plan) => plan.id === selectedSubscription?.plan_id);

  useEffect(() => {
    if (!billingSchoolId) return;
    const current = currentBySchool.get(billingSchoolId);
    setBilling((value) => ({
      ...value,
      planId: current?.plan_id ?? plans.find((plan) => plan.is_active)?.id ?? "",
      status: current?.status ?? "active",
      startsAt: current?.starts_at ?? today(),
      endsAt: current?.ends_at ?? "",
      autoRenew: current?.auto_renew ?? false,
      notes: current?.notes ?? "",
      amount: "",
      paymentDate: today(),
      reference: "",
    }));
  }, [billingSchoolId, currentBySchool, plans]);

  const createMutation = useMutation({
    mutationFn: () => {
      const name = form.name.trim();
      const code = form.code.trim();
      const adminName = form.adminName.trim();
      const adminEmail = form.adminEmail.trim();
      if (!name) throw new Error("Enter the school name first");
      if (!code) throw new Error("Enter the school code first");
      if (!adminName) throw new Error("Enter the administrator name first");
      if (!adminEmail) throw new Error("Enter the administrator email first");
      return createSchool({
        data: {
          ...form,
          name,
          code,
          adminName,
          adminEmail,
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        },
      });
    },
    onSuccess: (result) => {
      setIssued({ email: form.adminEmail, password: result.oneTimePassword });
      setForm({
        name: "",
        code: "",
        address: "",
        email: "",
        phone: "",
        adminName: "",
        adminEmail: "",
      });
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("School created with an administrator account");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { schoolId: string; status: "active" | "suspended" }) =>
      changeStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("School status updated");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const planMutation = useMutation({
    mutationFn: () => {
      const name = planForm.name.trim();
      const price = Number(planForm.price);
      if (!name) throw new Error("Enter a plan name");
      if (!Number.isFinite(price) || price < 0) throw new Error("Plan price cannot be negative");
      return editingPlanId
        ? updatePlan({
            data: {
              id: editingPlanId,
              name,
              price,
              billingCycle: planForm.billingCycle,
              description: planForm.description,
            },
          })
        : createPlan({
            data: {
              name,
              price,
              billingCycle: planForm.billingCycle,
              description: planForm.description,
            },
          });
    },
    onSuccess: () => {
      setEditingPlanId(null);
      setPlanForm({ name: "", price: "", billingCycle: "monthly", description: "" });
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      toast.success("Subscription plan saved");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const planStatusMutation = useMutation({
    mutationFn: (plan: Plan) =>
      changePlanStatus({ data: { id: plan.id, isActive: !plan.is_active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      toast.success("Plan availability updated");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const paymentStatusMutation = useMutation({
    mutationFn: (data: {
      paymentId: string;
      status: "pending" | "confirmed" | "failed" | "refunded";
    }) => changePaymentStatus({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-payments", billingSchoolId] });
      toast.success("Payment status updated");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  async function saveBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!billingSchoolId) return toast.error("Select a school before saving billing");
    if (!billing.planId) return toast.error("Select a subscription plan first");
    if (!billing.startsAt) return toast.error("Choose the subscription start date first");
    if (billing.endsAt && billing.endsAt < billing.startsAt) {
      return toast.error("Subscription end date must be on or after the start date");
    }
    const amount = billing.amount ? Number(billing.amount) : 0;
    if (billing.amount && (!Number.isFinite(amount) || amount <= 0)) {
      return toast.error("Payment amount must be greater than zero");
    }
    try {
      const subscription = await changeSubscription({
        data: {
          schoolId: billingSchoolId,
          planId: billing.planId,
          status: billing.status,
          startsAt: billing.startsAt,
          endsAt: billing.endsAt || undefined,
          autoRenew: billing.autoRenew,
          notes: billing.notes.trim() || undefined,
        },
      });
      if (amount > 0) {
        await recordPayment({
          data: {
            schoolId: billingSchoolId,
            subscriptionId: subscription.id,
            amount,
            currency: "UGX",
            paymentDate: billing.paymentDate || billing.startsAt,
            method: billing.method,
            status: billing.paymentStatus,
            reference: billing.reference.trim() || undefined,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: ["school-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["school-payments", billingSchoolId] });
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success(amount > 0 ? "Subscription and payment saved" : "Subscription saved");
    } catch (error) {
      toast.error(friendlyAdminError(error as Error));
    }
  }

  return (
    <div>
      <PageHeader title={title} description={description} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Schools"
          value={schools.length}
          hint={schoolsLoading ? "Loading" : "All tenants"}
        />
        <Stat
          label="Active subscriptions"
          value={
            subscriptions.filter((subscription) => effectiveStatus(subscription) === "active")
              .length
          }
        />
        <Stat
          label="Needs attention"
          value={
            subscriptions.filter((subscription) =>
              ["past_due", "expired"].includes(effectiveStatus(subscription)),
            ).length
          }
          hint="Past due or expired"
        />
        <Stat
          label="Plans"
          value={plans.filter((plan) => plan.is_active).length}
          hint="Available to assign"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Registered schools">
          <ResponsiveTable
            desktop={
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">School</th>
                    <th className="pb-2">Plan</th>
                    <th className="pb-2">Subscription</th>
                    <th className="pb-2">Tenant</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => {
                    const subscription = currentBySchool.get(school.id);
                    const status = effectiveStatus(subscription);
                    const plan = plans.find((item) => item.id === subscription?.plan_id);
                    return (
                      <tr key={school.id} className="border-t border-border">
                        <td className="py-3">
                          <p className="font-medium">{school.name}</p>
                          <p className="text-xs text-muted-foreground">{school.code}</p>
                        </td>
                        <td>{plan?.name ?? "—"}</td>
                        <td>
                          <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
                        </td>
                        <td>
                          <Pill tone={school.status === "active" ? "success" : "danger"}>
                            {school.status}
                          </Pill>
                        </td>
                        <td className="text-right">
                          <Btn variant="ghost" onClick={() => setBillingSchoolId(school.id)}>
                            Manage
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                  {!schools.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No schools yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            }
            mobile={
              <>
                {schools.map((school) => {
                  const subscription = currentBySchool.get(school.id);
                  const status = effectiveStatus(subscription);
                  const plan = plans.find((item) => item.id === subscription?.plan_id);
                  return (
                    <div
                      key={school.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{school.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{school.code}</p>
                        </div>
                        <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{plan?.name ?? "No plan"}</span>
                        <Btn variant="ghost" onClick={() => setBillingSchoolId(school.id)}>
                          Manage
                        </Btn>
                      </div>
                    </div>
                  );
                })}
                {!schools.length && (
                  <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    No schools yet.
                  </div>
                )}
              </>
            }
          />
        </Panel>

        <Panel title="Add a school">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <Field label="School name">
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="School code">
              <input
                required
                className={inputClass}
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </Field>
            <Field label="Address">
              <input
                className={inputClass}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </Field>
            <Field label="School email">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="School phone">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="Administrator name">
              <input
                required
                className={inputClass}
                value={form.adminName}
                onChange={(event) => setForm({ ...form, adminName: event.target.value })}
              />
            </Field>
            <Field label="Administrator email">
              <input
                required
                type="email"
                className={inputClass}
                value={form.adminEmail}
                onChange={(event) => setForm({ ...form, adminEmail: event.target.value })}
              />
            </Field>
            <Btn type="submit" variant="accent" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create school"}
            </Btn>
          </form>
          {issued && (
            <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm">
              <p className="font-semibold">One-time password issued</p>
              <p className="mt-1 break-all text-muted-foreground">{issued.email}</p>
              <p className="mt-1 font-mono text-base">{issued.password}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Share it securely. The administrator must change it at first sign-in.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {billingSchoolId && (
        <Panel title={`Manage billing · ${selectedSchool?.name ?? "School"}`} className="mt-4">
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-4">
            <Pill tone={statusTone(effectiveStatus(selectedSubscription))}>
              {statusLabel(effectiveStatus(selectedSubscription))}
            </Pill>
            <span className="text-sm text-muted-foreground">
              {selectedPlan?.name ?? "No plan assigned"}
            </span>
            {selectedSubscription?.ends_at && (
              <span className="text-sm text-muted-foreground">
                Ends {selectedSubscription.ends_at}
              </span>
            )}
            <Btn variant="ghost" onClick={() => setBillingSchoolId(null)}>
              Close
            </Btn>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
            <form className="space-y-3" onSubmit={saveBilling}>
              <p className="text-sm font-semibold">Assign subscription</p>
              <Field label="Plan">
                <select
                  required
                  className={inputClass}
                  value={billing.planId}
                  onChange={(event) => setBilling({ ...billing, planId: event.target.value })}
                >
                  <option value="">Select plan</option>
                  {plans
                    .filter((plan) => plan.is_active || plan.id === billing.planId)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ·{" "}
                        {plan.is_platform_only
                          ? "Lifetime"
                          : `${formatMoney(plan.price)}/${plan.billing_cycle}`}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    className={inputClass}
                    value={billing.status}
                    onChange={(event) =>
                      setBilling({
                        ...billing,
                        status: event.target.value as typeof billing.status,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="past_due">Past due</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Auto-renew">
                  <select
                    className={inputClass}
                    value={billing.autoRenew ? "yes" : "no"}
                    onChange={(event) =>
                      setBilling({ ...billing, autoRenew: event.target.value === "yes" })
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={billing.startsAt}
                    onChange={(event) => setBilling({ ...billing, startsAt: event.target.value })}
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="date"
                    className={inputClass}
                    value={billing.endsAt}
                    onChange={(event) => setBilling({ ...billing, endsAt: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Internal notes">
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={billing.notes}
                  onChange={(event) => setBilling({ ...billing, notes: event.target.value })}
                />
              </Field>
              <div className="border-t border-border pt-4">
                <p className="mb-3 text-sm font-semibold">
                  Record payment now{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (UGX)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={billing.amount}
                      onChange={(event) => setBilling({ ...billing, amount: event.target.value })}
                    />
                  </Field>
                  <Field label="Payment date">
                    <input
                      type="date"
                      className={inputClass}
                      value={billing.paymentDate}
                      onChange={(event) =>
                        setBilling({ ...billing, paymentDate: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Method">
                    <select
                      className={inputClass}
                      value={billing.method}
                      onChange={(event) => setBilling({ ...billing, method: event.target.value })}
                    >
                      <option value="mobile_money">Mobile money</option>
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Payment status">
                    <select
                      className={inputClass}
                      value={billing.paymentStatus}
                      onChange={(event) =>
                        setBilling({ ...billing, paymentStatus: event.target.value })
                      }
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </Field>
                </div>
                <Field label="Reference">
                  <input
                    className={inputClass}
                    value={billing.reference}
                    onChange={(event) => setBilling({ ...billing, reference: event.target.value })}
                  />
                </Field>
              </div>
              <Btn type="submit" variant="accent">
                Save subscription{billing.amount ? " and payment" : ""}
              </Btn>
            </form>
            <div>
              <p className="mb-3 text-sm font-semibold">Recent payments</p>
              {payments.length ? (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">
                          {formatMoney(payment.amount, payment.currency)}
                        </span>
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
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {payment.payment_date} · {payment.method}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {payment.status === "pending" && (
                          <Btn
                            variant="ghost"
                            onClick={() =>
                              paymentStatusMutation.mutate({
                                paymentId: payment.id,
                                status: "confirmed",
                              })
                            }
                          >
                            Confirm
                          </Btn>
                        )}
                        {payment.status === "confirmed" && (
                          <Btn
                            variant="ghost"
                            onClick={() =>
                              paymentStatusMutation.mutate({
                                paymentId: payment.id,
                                status: "refunded",
                              })
                            }
                          >
                            Mark refunded
                          </Btn>
                        )}
                        {payment.status === "refunded" && (
                          <Btn
                            variant="ghost"
                            onClick={() =>
                              paymentStatusMutation.mutate({
                                paymentId: payment.id,
                                status: "confirmed",
                              })
                            }
                          >
                            Restore
                          </Btn>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No payments recorded for this school.
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Subscription plans" className="mt-4">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              planMutation.mutate();
            }}
          >
            <p className="text-sm font-semibold">{editingPlanId ? "Edit plan" : "Create plan"}</p>
            <Field label="Plan name">
              <input
                required
                className={inputClass}
                value={planForm.name}
                onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}
              />
            </Field>
            <Field label="Price (UGX)">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={planForm.price}
                onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })}
              />
            </Field>
            <Field label="Billing cycle">
              <select
                className={inputClass}
                value={planForm.billingCycle}
                onChange={(event) =>
                  setPlanForm({
                    ...planForm,
                    billingCycle: event.target.value as Plan["billing_cycle"],
                  })
                }
              >
                <option value="monthly">Monthly</option>
                <option value="termly">Termly</option>
                <option value="annual">Annual</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea
                className={`${inputClass} min-h-20`}
                value={planForm.description}
                onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Btn type="submit" variant="accent" disabled={planMutation.isPending}>
                {editingPlanId ? "Update plan" : "Create plan"}
              </Btn>
              {editingPlanId && (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanForm({ name: "", price: "", billingCycle: "monthly", description: "" });
                  }}
                >
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <div className="space-y-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{plan.name}</p>
                    <Pill
                      tone={
                        plan.is_platform_only ? "warning" : plan.is_active ? "success" : "muted"
                      }
                    >
                      {plan.is_platform_only
                        ? "Super Admin only"
                        : plan.is_active
                          ? "Available"
                          : "Archived"}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatMoney(plan.price)}/{plan.billing_cycle}
                    {plan.is_platform_only ? " · Lifetime" : ""}
                    {plan.description ? ` · ${plan.description}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setEditingPlanId(plan.id);
                      setPlanForm({
                        name: plan.name,
                        price: String(plan.price),
                        billingCycle: plan.billing_cycle,
                        description: plan.description ?? "",
                      });
                    }}
                  >
                    Edit
                  </Btn>
                  <Btn variant="ghost" onClick={() => planStatusMutation.mutate(plan)}>
                    {plan.is_active ? "Archive" : "Activate"}
                  </Btn>
                </div>
              </div>
            ))}
            {!plans.length && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Create your first subscription plan.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
