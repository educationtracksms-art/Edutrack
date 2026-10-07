import { createServerFn } from "@tanstack/react-start";
import { requireRateLimitedSupabaseAuth as requireSupabaseAuth } from "@/integrations/supabase/rate-limited-auth-middleware";

export function durationToDays(value: number, unit: string): number {
  switch (unit) {
    case "days":   return value;
    case "weeks":  return value * 7;
    case "months": return value * 30;
    case "years":  return value * 365;
    default:       return value * 30;
  }
}

export function computeEndDate(startDate: Date, value: number, unit: string): Date {
  const days = durationToDays(value, unit);
  const end = new Date(startDate);
  end.setDate(end.getDate() + days);
  return end;
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function generatePaymentReference(schoolId: string, subscriptionId: string): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const hash = schoolId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const subHash = subscriptionId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `EDU-${hash}-${subHash}-${ts}`;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function rolesOf(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role);
}

async function schoolIdOf(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();
  return profile?.school_id ?? null;
}

async function logAudit(
  supabase: any,
  userId: string,
  schoolId: string | null,
  action: string,
  entity: string,
  details?: Record<string, unknown>,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  await supabase.from("audit_logs").insert({
    school_id: schoolId,
    user_id: userId,
    user_name: profile?.full_name ?? null,
    action,
    entity,
    details: details ?? {},
  });
}

async function notifySchoolAdmin(
  supabase: any,
  schoolId: string,
  title: string,
  body: string,
) {
  const { data: admin } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "school_admin")
    .maybeSingle();
  if (!admin) return;
  await supabase.from("notifications").insert({
    school_id: schoolId,
    user_id: admin.user_id,
    title,
    body,
    type: "subscription",
  });
}


// ─── Plan CRUD (Super Admin only) ────────────────────────────────────────────

export const createSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      name: string;
      price: number;
      durationValue: number;
      durationUnit: "days" | "weeks" | "months" | "years";
      description?: string;
      isPlatformOnly?: boolean;
      displayOrder?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can create subscription plans");
    }

    const { data: existing } = await context.supabase
      .from("subscription_plans")
      .select("id")
      .eq("name", data.name)
      .maybeSingle();

    if (existing) throw new Error(`A plan named "${data.name}" already exists`);

    const durationDays = durationToDays(data.durationValue, data.durationUnit);

    const { data: plan, error } = await context.supabase
      .from("subscription_plans")
      .insert({
        name: data.name,
        price: data.price,
        billing_cycle: data.durationUnit === "years" ? "annual"
          : data.durationUnit === "months" && data.durationValue >= 3 ? "termly" : "monthly",
        duration_value: data.durationValue,
        duration_unit: data.durationUnit,
        duration_days: durationDays,
        description: data.description ?? null,
        is_platform_only: data.isPlatformOnly ?? false,
        display_order: data.displayOrder ?? 99,
        is_active: true,
      })
      .select("id, name, price, duration_value, duration_unit, duration_days, billing_cycle, description, is_active, is_platform_only, display_order, created_at")
      .single();

    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      null,
      "PLAN_CREATED",
      "subscription_plans",
      { plan_name: data.name, price: data.price, duration: `${data.durationValue} ${data.durationUnit}` },
    );

    return { ok: true, plan };
  });

export const updateSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      planId: string;
      name?: string;
      price?: number;
      durationValue?: number;
      durationUnit?: "days" | "weeks" | "months" | "years";
      description?: string;
      isActive?: boolean;
      displayOrder?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can edit subscription plans");
    }

    const { data: existing, error: fetchError } = await context.supabase
      .from("subscription_plans")
      .select("id, name")
      .eq("id", data.planId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Plan not found");

    // Changing duration affects only new subscriptions.
    const durationDays = data.durationValue !== undefined && data.durationUnit !== undefined
      ? durationToDays(data.durationValue, data.durationUnit)
      : undefined;

    const updatePayload: Record<string, string | number | boolean | null | undefined> = {};
    if (data.name !== undefined)              updatePayload.name = data.name;
    if (data.price !== undefined)             updatePayload.price = data.price;
    if (data.durationValue !== undefined)     updatePayload.duration_value = data.durationValue;
    if (data.durationUnit !== undefined)      updatePayload.duration_unit = data.durationUnit;
    if (data.description !== undefined)      updatePayload.description = data.description;
    if (data.isActive !== undefined)          updatePayload.is_active = data.isActive;
    if (data.displayOrder !== undefined)      updatePayload.display_order = data.displayOrder;
    if (durationDays !== undefined)           updatePayload.duration_days = durationDays;

    const { data: plan, error } = await (context.supabase
      .from("subscription_plans") as unknown as {
      update: (values: Record<string, string | number | boolean | null>) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => { single: () => Promise<{ data: { name: string } | null; error: { message: string } | null }> };
        };
      };
    })
      .update(updatePayload as Record<string, string | number | boolean | null>)
      .eq("id", data.planId)
      .select("id, name, price, duration_value, duration_unit, duration_days, billing_cycle, description, is_active, is_platform_only, display_order, created_at")
      .single();

    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      null,
      "PLAN_UPDATED",
      "subscription_plans",
      { plan_id: data.planId, plan_name: plan?.name, changes: Object.keys(updatePayload) },
    );

    return { ok: true, plan };
  });

export const deleteSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can delete subscription plans");
    }

    // Soft-delete: mark inactive (existing subscriptions remain valid).
    const { data: plan, error } = await context.supabase
      .from("subscription_plans")
      .update({ is_active: false })
      .eq("id", data.planId)
      .select("id, name")
      .single();

    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Plan not found");

    await logAudit(
      context.supabase,
      context.userId,
      null,
      "PLAN_DEACTIVATED",
      "subscription_plans",
      { plan_id: data.planId, plan_name: plan.name },
    );

    return { ok: true };
  });

// ─── School Subscription: Create (School Admin only) ────────────────────────
export const createSchoolSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("school_admin")) {
      throw new Error("Only the School Admin can manage subscriptions");
    }

    const schoolId = await schoolIdOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    // Enforce single active subscription rule.
    const { data: openSub } = await context.supabase
      .from("school_subscriptions")
      .select("id, status")
      .eq("school_id", schoolId)
      .in("status", ["trial", "active", "past_due", "pending", "confirmed"])
      .maybeSingle();

    if (openSub) {
      throw new Error(
        "This school already has an active subscription. Please cancel it before subscribing to a new plan.",
      );
    }

    const { data: plan, error: planError } = await context.supabase
      .from("subscription_plans")
      .select("id, name, price, duration_value, duration_unit, duration_days, is_active, is_platform_only")
      .eq("id", data.planId)
      .maybeSingle();

    if (planError) throw new Error(planError.message);
    if (!plan) throw new Error("Plan not found");
    if (!plan.is_active) throw new Error("This plan is no longer available");
    if (plan.is_platform_only) throw new Error("This plan is managed by the Super Admin");

    const startDate = new Date();
    const endDate = computeEndDate(startDate, Number(plan.duration_value), plan.duration_unit);

    const { data: subscription, error: subError } = await context.supabase.rpc("change_own_school_subscription", {
      p_plan_id: data.planId,
      p_status: "pending",
      p_starts_at: toDateStr(startDate),
      p_ends_at: toDateStr(endDate),
      p_auto_renew: false,
    });

    if (subError) throw new Error(subError.message);

    const paymentRef = generatePaymentReference(schoolId, subscription.id);
    await context.supabase
      .from("school_subscriptions")
      .update({ payment_reference: paymentRef })
      .eq("id", subscription.id);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "SUBSCRIPTION_CREATED",
      "school_subscriptions",
      {
        subscription_id: subscription.id,
        plan_id: data.planId,
        plan_name: plan.name,
        price: Number(plan.price),
        duration: `${plan.duration_value} ${plan.duration_unit}`,
        start_date: toDateStr(startDate),
        end_date: toDateStr(endDate),
        payment_reference: paymentRef,
        status: "pending",
      },
    );

    const { data: school } = await context.supabase
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();

    await notifySchoolAdmin(
      context.supabase,
      schoolId,
      "Subscription pending confirmation",
      `Your subscription to the "${plan.name}" plan (UGX ${Number(plan.price).toLocaleString()}) has been submitted. Please complete payment to activate.`,
    );

    return {
      ok: true,
      subscription: {
        id: subscription.id,
        plan_id: subscription.plan_id,
        status: subscription.status as "pending",
        starts_at: subscription.starts_at,
        ends_at: subscription.ends_at,
        payment_reference: paymentRef,
        plan: {
          name: plan.name,
          price: Number(plan.price),
          duration_value: Number(plan.duration_value),
          duration_unit: plan.duration_unit,
          duration_days: Number(plan.duration_days),
        },
      },
    };
  });

// ─── School Subscription: Cancel (School Admin for pending, Super Admin for any) ──

export const cancelSchoolSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { subscriptionId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const isSuper = roles.includes("super_admin");
    const isSchoolAdmin = roles.includes("school_admin");

    if (!isSuper && !isSchoolAdmin) {
      throw new Error("Only the School Admin or Super Admin can cancel subscriptions");
    }

    const schoolId = await schoolIdOf(context.supabase, context.userId);

    const { data: subscription, error: fetchError } = await context.supabase
      .from("school_subscriptions")
      .select("id, school_id, status")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!subscription) throw new Error("Subscription not found");

    if (!isSuper && subscription.school_id !== schoolId) {
      throw new Error("You can only cancel subscriptions for your own school");
    }

    if (isSchoolAdmin && subscription.status !== "pending") {
      throw new Error(
        "You can only cancel a pending subscription. Contact the Super Admin to cancel an active subscription.",
      );
    }

    const { data: updated, error: updateError } = await context.supabase
      .from("school_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.subscriptionId)
      .select("id, status")
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAudit(
      context.supabase,
      context.userId,
      subscription.school_id,
      "SUBSCRIPTION_CANCELLED",
      "school_subscriptions",
      {
        subscription_id: data.subscriptionId,
        previous_status: subscription.status,
        cancelled_by: isSuper ? "super_admin" : "school_admin",
        reason: data.reason ?? null,
      },
    );

    if (isSuper) {
      await notifySchoolAdmin(
        context.supabase,
        subscription.school_id,
        "Subscription cancelled",
        "Your school's subscription has been cancelled by the platform administrator.",
      );
    }

    return { ok: true, subscriptionId: data.subscriptionId, newStatus: "cancelled" };
  });


// ─── Payment Confirmation (Super Admin only) ────────────────────────────────

export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      subscriptionId: string;
      paymentMethod: "mtn" | "airtel" | "bank" | "other";
      confirmedAmount?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can confirm payments");
    }

    const { data: subscription, error: fetchError } = await context.supabase
      .from("school_subscriptions")
      .select("id, school_id, status, plan_id, payment_reference, starts_at, ends_at")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!subscription) throw new Error("Subscription not found");

    if (subscription.status !== "pending") {
      throw new Error(
        `Cannot confirm payment: subscription is in "${subscription.status}" status. Only "pending" subscriptions can be confirmed.`,
      );
    }

    const { data: plan, error: planError } = await context.supabase
      .from("subscription_plans")
      .select("id, name, price, duration_value, duration_unit, duration_days")
      .eq("id", subscription.plan_id)
      .maybeSingle();

    if (planError) throw new Error(planError.message);
    if (!plan) throw new Error("Plan not found");

    const startDate = subscription.starts_at ? new Date(subscription.starts_at) : new Date();
    const endDate = computeEndDate(startDate, Number(plan.duration_value), plan.duration_unit);
    const endStr = toDateStr(endDate);

    const paymentRef = subscription.payment_reference
      ?? generatePaymentReference(subscription.school_id, data.subscriptionId);

    const { data: updated, error: updateError } = await context.supabase
      .from("school_subscriptions")
      .update({
        status: "active",
        payment_reference: paymentRef,
        payment_confirmed_by: context.userId,
        payment_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.subscriptionId)
      .select("id, status, payment_reference, payment_confirmed_at")
      .single();

    if (updateError) throw new Error(updateError.message);

    await context.supabase.from("school_payments").insert({
      school_id: subscription.school_id,
      subscription_id: data.subscriptionId,
      amount: Number(plan.price),
      currency: "UGX",
      payment_date: toDateStr(new Date()),
      method: data.paymentMethod === "mtn" || data.paymentMethod === "airtel" ? "mobile_money" : data.paymentMethod,
      reference: paymentRef,
      status: "confirmed",
      notes: `Confirmed by Super Admin via ${data.paymentMethod}`,
      recorded_by: context.userId,
    }).select("id").single().then(
      () => undefined,
      (e: Error) => console.error("Failed to record payment:", e.message),
    );

    await logAudit(
      context.supabase,
      context.userId,

      subscription.school_id,
      "PAYMENT_CONFIRMED",
      "school_subscriptions",
      {
        subscription_id: data.subscriptionId,
        plan_name: plan.name,
        amount: Number(plan.price),
        payment_method: data.paymentMethod,
        payment_reference: paymentRef,
        previous_status: "pending",
        new_status: "active",
        start_date: subscription.starts_at,
        end_date: endStr,
      },
    );

    const { data: school } = await context.supabase
      .from("schools")
      .select("name")
      .eq("id", subscription.school_id)
      .maybeSingle();

    await notifySchoolAdmin(
      context.supabase,
      subscription.school_id,
      "Subscription activated",
      `Your ${school?.name ?? "school"} subscription to the "${plan.name}" plan has been activated. Access is active until ${endStr}.`,
    );

    return {
      ok: true,
      subscriptionId: data.subscriptionId,
      newStatus: "active",
      paymentReference: paymentRef,
      startDate: subscription.starts_at,
      endDate: endStr,
    };
  });

// ─── Expiry status check (used by route guards) ─────────────────────────────

export const getSchoolSubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await schoolIdOf(context.supabase, context.userId);
    if (!schoolId) return { status: "no_school", subscription: null };

    const { data: subscription, error } = await context.supabase
      .from("school_subscriptions")
      .select("id, status, starts_at, ends_at, plan_id, payment_reference")
      .eq("school_id", schoolId)
      .in("status", ["trial", "active", "past_due", "pending", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    let effectiveStatus = subscription?.status ?? "not_configured";
    if (subscription?.ends_at) {
      const today = new Date();
      const end = new Date(subscription.ends_at);
      if (end < today && ["trial", "active", "past_due", "pending", "confirmed"].includes(subscription.status)) {
        effectiveStatus = "expired";
      }
    }

    return { status: effectiveStatus, subscription, schoolId };
  });

// ─── Super Admin: List all subscriptions ─────────────────────────────────────

export const listAllSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can view all subscriptions");
    }

    const { data: subscriptions, error } = await context.supabase
      .from("school_subscriptions")
      .select(`
        id,
        school_id,
        plan_id,
        status,
        starts_at,
        ends_at,
        payment_reference,
        payment_confirmed_by,
        payment_confirmed_at,
        created_at,
        updated_at,
        schools (name, code, status),
        subscription_plans (id, name, price, duration_value, duration_unit, duration_days, is_active, description)
      `)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return { subscriptions: subscriptions ?? [] };
  });

// ─── Super Admin: Get single subscription ────────────────────────────────────

export const getSubscriptionDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { subscriptionId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can view subscription details");
    }

    const { data: subscription, error } = await context.supabase
      .from("school_subscriptions")
      .select(`
        id,
        school_id,
        plan_id,
        status,
        starts_at,
        ends_at,
        payment_reference,
        payment_confirmed_by,
        payment_confirmed_at,
        created_at,
        updated_at,
        notes,
        schools (id, name, code, status, address, email, phone),
        subscription_plans (id, name, price, duration_value, duration_unit, duration_days, is_active, description, is_platform_only, display_order)
      `)
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return { subscription };
  });

// ─── Super Admin: Revoke any subscription ────────────────────────────────────

export const revokeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { subscriptionId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Only the Super Admin can revoke subscriptions");
    }

    const { data: subscription, error: fetchError } = await context.supabase
      .from("school_subscriptions")
      .select("id, school_id, status")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!subscription) throw new Error("Subscription not found");

    const { data: updated, error: updateError } = await context.supabase
      .from("school_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.subscriptionId)
      .select("id, status")
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAudit(
      context.supabase,
      context.userId,
      subscription.school_id,
      "SUBSCRIPTION_REVOKED",
      "school_subscriptions",
      {
        subscription_id: data.subscriptionId,
        previous_status: subscription.status,
        reason: data.reason ?? null,
      },
    );

    await notifySchoolAdmin(
      context.supabase,
      subscription.school_id,
      "Subscription revoked",
      "Your school's subscription has been revoked by the platform administrator.",
    );

    return { ok: true, subscriptionId: data.subscriptionId, newStatus: "cancelled" };
  });